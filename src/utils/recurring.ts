import type { ISODate, MonthKey, NewRow, Recurring, Transaction } from '@/types'
import { addMonths, dateInMonth, daysInMonth, monthNumber, monthOf, parseISO, todayISO } from './date'

/** Datas em que um recorrente acontece dentro do mês, respeitando início e fim. */
export function occurrencesInMonth(rec: Recurring, month: MonthKey): ISODate[] {
  let dates: ISODate[] = []
  if (rec.frequency === 'monthly') {
    dates = [dateInMonth(month, rec.day)]
  } else if (rec.frequency === 'yearly') {
    const target = rec.month ?? monthNumber(rec.start_date)
    if (monthNumber(month) === target) dates = [dateInMonth(month, rec.day)]
  } else {
    const weekday = rec.weekday ?? 1
    for (let day = 1; day <= daysInMonth(month); day++) {
      const iso = dateInMonth(month, day)
      if (parseISO(iso).getDay() === weekday) dates.push(iso)
    }
  }
  return dates.filter((d) => d >= rec.start_date && (!rec.end_date || d <= rec.end_date))
}

/** Valor mensal equivalente, para comparar frequências diferentes com a renda. */
export function monthlyEquivalent(rec: Recurring): number {
  if (rec.frequency === 'weekly') return Math.round((rec.amount_cents * 52) / 12)
  if (rec.frequency === 'yearly') return Math.round(rec.amount_cents / 12)
  return rec.amount_cents
}

export function recurringToTx(rec: Recurring, date: ISODate): NewRow<'transactions'> {
  return {
    description: rec.description,
    amount_cents: rec.amount_cents,
    type: rec.type,
    category_id: rec.category_id,
    date,
    payment_method: rec.payment_method,
    account_id: rec.card_id ? null : rec.account_id,
    card_id: rec.card_id,
    notes: null,
    paid: false,
    recurring_id: rec.id,
    installment_id: null,
    installment_number: null,
    installment_total: null,
  }
}

/** Primeiro mês que ainda não teve lançamentos gerados para este recorrente. */
export function firstUngeneratedMonth(rec: Recurring, today: ISODate = todayISO()): MonthKey {
  const start = monthOf(rec.start_date)
  if (rec.generated_until) {
    const next = addMonths(rec.generated_until, 1)
    return next > start ? next : start
  }
  // Recorrente novo: nunca preenche o passado, começa no mês corrente.
  const current = monthOf(today)
  return current > start ? current : start
}

/**
 * Ocorrências previstas de recorrentes em meses que ainda não foram gravados
 * no banco (meses futuros). Permite projetar compromissos sem criar registros.
 */
export function virtualRecurring(
  recurring: readonly Recurring[],
  month: MonthKey,
  today: ISODate = todayISO(),
): Transaction[] {
  const out: Transaction[] = []
  for (const rec of recurring) {
    if (!rec.active || month < firstUngeneratedMonth(rec, today)) continue
    for (const date of occurrencesInMonth(rec, month)) {
      out.push({
        ...recurringToTx(rec, date),
        id: `virtual:${rec.id}:${date}`,
        user_id: rec.user_id,
        created_at: '',
        updated_at: '',
        virtual: true,
      })
    }
  }
  return out
}
