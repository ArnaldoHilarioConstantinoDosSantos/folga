import { isSupabaseConfigured } from '@/lib/supabase'
import type {
  AccountType,
  ISODate,
  NewRow,
  Patch,
  PlanAllocation,
  Profile,
  Recurring,
  TableName,
  Transaction,
} from '@/types'
import { addMonths, addMonthsToDate, monthOf, startOfMonth, todayISO } from '@/utils/date'
import { splitInstallments } from '@/utils/money'
import { firstUngeneratedMonth, occurrencesInMonth, recurringToTx } from '@/utils/recurring'
import type { AuthUser } from './auth'
import { db } from './db'
import { buildDefaultCategories, seedDemoData } from './seed'

/**
 * Operações que mexem em mais de uma tabela. Cada uma devolve as tabelas que
 * alterou, para o chamador invalidar o cache certo.
 */

const uid = () => crypto.randomUUID()

/* ------------------------------------------------------------------ */
/* Inicialização da conta                                              */
/* ------------------------------------------------------------------ */

async function ensureProfile(user: AuthUser): Promise<Profile> {
  const existing = (await db.list('profiles')).find((p) => p.id === user.id)
  if (existing) return existing
  // No Supabase o perfil nasce por trigger; este insert cobre o modo
  // demonstração e contas criadas antes de o schema existir.
  const [created] = await db.insert('profiles', [
    { id: user.id, full_name: user.name, pay_day: null, financial_goal: null, onboarded: false, defaults_seeded: false },
  ])
  return created
}

/**
 * Roda uma vez a cada login: garante perfil e categorias padrão e gera os
 * lançamentos dos recorrentes até o mês atual.
 */
export async function bootstrap(user: AuthUser): Promise<void> {
  const profile = await ensureProfile(user)
  if (!profile.defaults_seeded) {
    if (isSupabaseConfigured) {
      if ((await db.list('categories')).length === 0) await db.insert('categories', buildDefaultCategories())
      await db.update('profiles', [profile.id], { defaults_seeded: true })
    } else {
      // Modo demonstração: a primeira visita já abre com dados de exemplo.
      await loadDemoData(profile.id)
    }
  }
  await materializeRecurring()
}

export async function loadDemoData(profileId: string): Promise<TableName[]> {
  await db.clearAll()
  await seedDemoData(db, todayISO())
  await db.update('profiles', [profileId], {
    onboarded: true,
    defaults_seeded: true,
    pay_day: 1,
    financial_goal: 'Montar minha reserva de emergência',
  })
  return ALL_TABLES
}

/** Apaga tudo e volta ao estado de conta nova (categorias padrão + onboarding). */
export async function resetAccount(profileId: string): Promise<TableName[]> {
  await db.clearAll()
  await db.insert('categories', buildDefaultCategories())
  await db.update('profiles', [profileId], {
    onboarded: false,
    defaults_seeded: true,
    pay_day: null,
    financial_goal: null,
  })
  return ALL_TABLES
}

const ALL_TABLES: TableName[] = [
  'profiles', 'accounts', 'categories', 'transactions', 'recurring_transactions', 'credit_cards',
  'installments', 'budgets', 'financial_goals', 'goal_contributions', 'monthly_plans', 'transfers', 'notifications',
]

/* ------------------------------------------------------------------ */
/* Recorrentes                                                         */
/* ------------------------------------------------------------------ */

/**
 * Gera como lançamentos pendentes as ocorrências de recorrentes ainda não
 * gravadas, do último mês gerado até o mês atual. É assim que os gastos fixos
 * "aparecem sozinhos" quando o mês vira.
 */
export async function materializeRecurring(today: ISODate = todayISO()): Promise<TableName[]> {
  const current = monthOf(today)
  const recurring = (await db.list('recurring_transactions')).filter(
    (r) => r.active && firstUngeneratedMonth(r, today) <= current,
  )
  if (recurring.length === 0) return []

  const rows: NewRow<'transactions'>[] = []
  for (const rec of recurring) {
    for (let m = firstUngeneratedMonth(rec, today); m <= current; m = addMonths(m, 1)) {
      for (const date of occurrencesInMonth(rec, m)) rows.push(recurringToTx(rec, date))
    }
  }
  if (rows.length > 0) {
    // Se uma execução anterior parou no meio, não duplica o que já existe.
    const existing = new Set(
      (await db.list('transactions')).filter((t) => t.recurring_id).map((t) => `${t.recurring_id}|${t.date}`),
    )
    const fresh = rows.filter((r) => !existing.has(`${r.recurring_id}|${r.date}`))
    if (fresh.length > 0) await db.insert('transactions', fresh)
  }
  await db.update('recurring_transactions', recurring.map((r) => r.id), { generated_until: current })
  return ['transactions', 'recurring_transactions']
}

export async function createRecurring(row: NewRow<'recurring_transactions'>): Promise<TableName[]> {
  await db.insert('recurring_transactions', [row])
  await materializeRecurring()
  return ['recurring_transactions', 'transactions']
}

/**
 * Lançamento marcado como "repetir todo mês": grava o lançamento e cria o
 * recorrente mensal a partir dele, no mesmo dia do mês.
 */
export async function createRepeatingTransaction(tx: NewRow<'transactions'>): Promise<TableName[]> {
  const recurringId = uid()
  await db.insert('recurring_transactions', [
    {
      id: recurringId,
      description: tx.description,
      amount_cents: tx.amount_cents,
      type: tx.type,
      category_id: tx.category_id,
      frequency: 'monthly',
      day: Number(tx.date.slice(8, 10)),
      weekday: null,
      month: null,
      payment_method: tx.payment_method,
      account_id: tx.account_id,
      card_id: tx.card_id,
      active: true,
      start_date: tx.date,
      end_date: null,
      generated_until: monthOf(tx.date),
    },
  ])
  await db.insert('transactions', [{ ...tx, recurring_id: recurringId }])
  await materializeRecurring()
  return ['recurring_transactions', 'transactions']
}

/** Atualiza o recorrente e os lançamentos dele que ainda estão pendentes deste mês em diante. */
export async function updateRecurring(
  rec: Recurring,
  patch: Patch<'recurring_transactions'>,
  transactions: readonly Transaction[],
): Promise<TableName[]> {
  await db.update('recurring_transactions', [rec.id], patch)
  const next = { ...rec, ...patch }
  const from = startOfMonth(monthOf(todayISO()))
  const pending = transactions.filter((t) => t.recurring_id === rec.id && !t.paid && t.date >= from)
  if (pending.length > 0) {
    await db.update('transactions', pending.map((t) => t.id), {
      description: next.description,
      amount_cents: next.amount_cents,
      category_id: next.category_id,
      payment_method: next.payment_method,
      account_id: next.card_id ? null : next.account_id,
      card_id: next.card_id,
    })
  }
  await materializeRecurring()
  return ['recurring_transactions', 'transactions']
}

/** Remove o recorrente e seus lançamentos pendentes; o histórico pago é mantido. */
export async function removeRecurring(rec: Recurring, transactions: readonly Transaction[]): Promise<TableName[]> {
  const pending = transactions.filter((t) => t.recurring_id === rec.id && !t.paid)
  if (pending.length > 0) await db.remove('transactions', pending.map((t) => t.id))
  await db.remove('recurring_transactions', [rec.id])
  return ['recurring_transactions', 'transactions']
}

/* ------------------------------------------------------------------ */
/* Parcelamentos                                                       */
/* ------------------------------------------------------------------ */

/** Cria a compra parcelada e uma despesa para cada parcela, mês a mês. */
export async function createInstallment(row: NewRow<'installments'>): Promise<TableName[]> {
  const id = row.id ?? uid()
  await db.insert('installments', [{ ...row, id }])
  const today = todayISO()
  const parcels = splitInstallments(row.total_cents, row.count).map(
    (amount, i): NewRow<'transactions'> => {
      const date = addMonthsToDate(row.first_date, i)
      return {
        description: row.description,
        amount_cents: amount,
        type: 'expense',
        category_id: row.category_id,
        date,
        payment_method: row.payment_method,
        account_id: row.card_id ? null : row.account_id,
        card_id: row.card_id,
        notes: row.notes,
        // Fora do cartão, parcelas de datas passadas entram como já pagas.
        paid: !row.card_id && date < today,
        recurring_id: null,
        installment_id: id,
        installment_number: i + 1,
        installment_total: row.count,
      }
    },
  )
  try {
    await db.insert('transactions', parcels)
  } catch (error) {
    await db.remove('installments', [id]).catch(() => undefined)
    throw error
  }
  return ['installments', 'transactions']
}

export async function updateInstallment(
  id: string,
  patch: Pick<NewRow<'installments'>, 'description' | 'category_id' | 'notes'>,
  transactions: readonly Transaction[],
): Promise<TableName[]> {
  await db.update('installments', [id], patch)
  const parcels = transactions.filter((t) => t.installment_id === id)
  if (parcels.length > 0) {
    await db.update('transactions', parcels.map((t) => t.id), {
      description: patch.description,
      category_id: patch.category_id,
    })
  }
  return ['installments', 'transactions']
}

/* ------------------------------------------------------------------ */
/* Cartões                                                             */
/* ------------------------------------------------------------------ */

/** Pagar a fatura debita a conta escolhida e libera o limite. */
export async function payInvoice(items: readonly Transaction[], accountId: string | null): Promise<TableName[]> {
  const open = items.filter((t) => !t.paid)
  if (open.length > 0) await db.update('transactions', open.map((t) => t.id), { paid: true, account_id: accountId })
  return ['transactions']
}

export async function reopenInvoice(items: readonly Transaction[]): Promise<TableName[]> {
  const paid = items.filter((t) => t.paid)
  if (paid.length > 0) await db.update('transactions', paid.map((t) => t.id), { paid: false, account_id: null })
  return ['transactions']
}

/* ------------------------------------------------------------------ */
/* Onboarding                                                          */
/* ------------------------------------------------------------------ */

export interface OnboardingAnswers {
  name: string
  incomeCents: number
  extraIncomeCents: number
  payDay: number
  accounts: Array<{ name: string; type: AccountType; balanceCents: number }>
  cards: Array<{ name: string; limitCents: number; closingDay: number; dueDay: number }>
  fixed: Array<{ description: string; amountCents: number; day: number; categoryId: string | null }>
  goal: { label: string; name: string; targetCents: number; emergency: boolean } | null
}

/** Percentuais sugeridos da renda para gastos variáveis no primeiro planejamento. */
const SUGGESTED_SHARE: Record<string, number> = {
  Alimentação: 0.12,
  Transporte: 0.08,
  Saúde: 0.04,
  Lazer: 0.06,
  Compras: 0.05,
}
const SAVINGS_SHARE = 0.15

/**
 * Grava as respostas do onboarding e monta o primeiro planejamento mensal:
 * gastos fixos por categoria + sugestão para os variáveis + reserva; o que
 * sobrar fica como "Livre".
 */
export async function completeOnboarding(profileId: string, answers: OnboardingAnswers): Promise<TableName[]> {
  const today = todayISO()
  const month = monthOf(today)
  const categories = await db.list('categories')
  const rootId = (id: string | null) => {
    const c = categories.find((x) => x.id === id)
    return c ? (c.parent_id ?? c.id) : null
  }
  const byName = (name: string, type: 'income' | 'expense') =>
    categories.find((c) => c.name === name && c.type === type && !c.parent_id)

  const accounts = answers.accounts.map((a, i) => ({
    id: uid(),
    name: a.name,
    type: a.type,
    initial_balance_cents: a.balanceCents,
    color: (['blue', 'violet', 'brown', 'green', 'orange'] as const)[i % 5],
  }))
  if (accounts.length > 0) await db.insert('accounts', accounts)
  const mainAccount = accounts[0]?.id ?? null

  if (answers.cards.length > 0) {
    await db.insert(
      'credit_cards',
      answers.cards.map((c, i) => ({
        name: c.name,
        bank: c.name,
        limit_cents: c.limitCents,
        closing_day: c.closingDay,
        due_day: c.dueDay,
        color: (['violet', 'orange', 'blue', 'red'] as const)[i % 4],
      })),
    )
  }

  const recurringBase = {
    frequency: 'monthly' as const,
    weekday: null,
    month: null,
    account_id: mainAccount,
    card_id: null,
    active: true,
    start_date: startOfMonth(month),
    end_date: null,
    generated_until: null,
  }
  const recurring: NewRow<'recurring_transactions'>[] = []
  if (answers.incomeCents > 0) {
    recurring.push({
      ...recurringBase,
      description: 'Salário',
      amount_cents: answers.incomeCents,
      type: 'income',
      category_id: byName('Salário', 'income')?.id ?? null,
      day: answers.payDay,
      payment_method: 'transfer',
    })
  }
  if (answers.extraIncomeCents > 0) {
    recurring.push({
      ...recurringBase,
      description: 'Renda extra',
      amount_cents: answers.extraIncomeCents,
      type: 'income',
      category_id: byName('Renda extra', 'income')?.id ?? null,
      day: answers.payDay,
      payment_method: 'pix',
    })
  }
  for (const f of answers.fixed) {
    recurring.push({
      ...recurringBase,
      description: f.description,
      amount_cents: f.amountCents,
      type: 'expense',
      category_id: f.categoryId,
      day: f.day,
      payment_method: 'boleto',
    })
  }
  if (recurring.length > 0) await db.insert('recurring_transactions', recurring)

  if (answers.goal && answers.goal.targetCents > 0) {
    await db.insert('financial_goals', [
      {
        name: answers.goal.name,
        target_cents: answers.goal.targetCents,
        target_date: null,
        icon: answers.goal.emergency ? 'shield' : 'target',
        color: answers.goal.emergency ? 'green' : 'blue',
        kind: answers.goal.emergency ? 'emergency' : 'goal',
      },
    ])
  }

  /* Primeiro planejamento */
  const income = answers.incomeCents + answers.extraIncomeCents
  const perCategory = new Map<string, number>()
  for (const f of answers.fixed) {
    const root = rootId(f.categoryId)
    if (root) perCategory.set(root, (perCategory.get(root) ?? 0) + f.amountCents)
  }
  const budgets: NewRow<'budgets'>[] = []
  for (const [name, share] of Object.entries(SUGGESTED_SHARE)) {
    const category = byName(name, 'expense')
    if (!category) continue
    const suggested = Math.round((income * share) / 1000) * 1000
    perCategory.set(category.id, (perCategory.get(category.id) ?? 0) + suggested)
    if (suggested > 0) budgets.push({ category_id: category.id, limit_cents: perCategory.get(category.id)! })
  }
  const allocations: PlanAllocation[] = [...perCategory.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([categoryId, amount]) => ({
      key: uid(),
      label: categories.find((c) => c.id === categoryId)?.name ?? 'Categoria',
      category_id: categoryId,
      amount_cents: amount,
    }))
  const committed = allocations.reduce((sum, a) => sum + a.amount_cents, 0)
  const savings = Math.max(0, Math.min(Math.round((income * SAVINGS_SHARE) / 1000) * 1000, income - committed))
  if (savings > 0) {
    allocations.push({ key: uid(), label: answers.goal?.name || 'Reserva', category_id: null, amount_cents: savings })
  }
  const free = income - committed - savings
  if (free > 0) allocations.push({ key: uid(), label: 'Livre', category_id: null, amount_cents: free })

  if (income > 0) {
    await db.insert('monthly_plans', [{ month, expected_income_cents: income, allocations }])
    if (budgets.length > 0) await db.insert('budgets', budgets)
  }

  await db.update('profiles', [profileId], {
    full_name: answers.name,
    pay_day: answers.payDay,
    financial_goal: answers.goal?.label ?? null,
    onboarded: true,
  })
  await materializeRecurring(today)
  return ALL_TABLES
}
