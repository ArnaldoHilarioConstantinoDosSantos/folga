import { describe, expect, it } from 'vitest'
import type { CreditCard, FinanceData, Recurring, Transaction } from '@/types'
import { addMonths, addMonthsToDate, dateInMonth, monthDiff } from './date'
import {
  accountBalances,
  budgetStatuses,
  cardInvoices,
  cardUsage,
  futureCommitments,
  goalStatus,
  incomeDistribution,
  invoiceDueDate,
  invoiceKeyOf,
  summarize,
} from './finance'
import { monthInsights } from './insights'
import { formatBRL, formatPercent, parseBRL, splitInstallments } from './money'
import { buildNotifications } from './notifications'
import { occurrencesInMonth, virtualRecurring } from './recurring'

const TODAY = '2026-09-15'
const base = { user_id: 'u', created_at: '', updated_at: '' }

function tx(partial: Partial<Transaction> & Pick<Transaction, 'amount_cents' | 'date'>): Transaction {
  return {
    ...base,
    id: crypto.randomUUID(),
    description: 'Lançamento',
    type: 'expense',
    category_id: null,
    payment_method: 'pix',
    account_id: null,
    card_id: null,
    notes: null,
    paid: true,
    recurring_id: null,
    installment_id: null,
    installment_number: null,
    installment_total: null,
    ...partial,
  }
}

function rec(partial: Partial<Recurring>): Recurring {
  return {
    ...base,
    id: crypto.randomUUID(),
    description: 'Fixo',
    amount_cents: 10_000,
    type: 'expense',
    category_id: null,
    frequency: 'monthly',
    day: 10,
    weekday: null,
    month: null,
    payment_method: 'boleto',
    account_id: null,
    card_id: null,
    active: true,
    start_date: '2026-01-01',
    end_date: null,
    generated_until: '2026-09',
    ...partial,
  }
}

function data(partial: Partial<FinanceData> = {}): FinanceData {
  return {
    profile: { id: 'u', full_name: 'Teste', pay_day: 5, financial_goal: null, onboarded: true, defaults_seeded: true, created_at: '', updated_at: '' },
    accounts: [],
    categories: [],
    transactions: [],
    recurring: [],
    cards: [],
    installments: [],
    budgets: [],
    goals: [],
    contributions: [],
    plans: [],
    transfers: [],
    notifications: [],
    ...partial,
  }
}

const card: CreditCard = { ...base, id: 'card', name: 'Nubank', bank: '', limit_cents: 800_000, closing_day: 13, due_day: 20, color: 'violet' }

describe('dinheiro', () => {
  it('formata no padrão brasileiro', () => {
    expect(formatBRL(125_000)).toBe('R$ 1.250,00')
    expect(formatBRL(-3_990)).toBe('- R$ 39,90')
    expect(formatBRL(0)).toBe('R$ 0,00')
    expect(formatPercent(0.18)).toBe('18%')
    expect(formatPercent(0.042, 1)).toBe('4,2%')
  })

  it('interpreta valores digitados', () => {
    expect(parseBRL('1.250,00')).toBe(125_000)
    expect(parseBRL('R$ 39,9')).toBe(3_990)
    expect(parseBRL('1250')).toBe(125_000)
    expect(parseBRL('')).toBe(0)
  })

  it('divide parcelas sem perder centavos', () => {
    expect(splitInstallments(360_000, 12)).toEqual(Array(12).fill(30_000))
    const parcels = splitInstallments(10_000, 3)
    expect(parcels).toEqual([3_334, 3_333, 3_333])
    expect(parcels.reduce((a, b) => a + b, 0)).toBe(10_000)
  })
})

describe('datas', () => {
  it('soma meses atravessando o ano', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(monthDiff('2026-11', '2027-02')).toBe(3)
  })

  it('limita o dia ao tamanho do mês', () => {
    expect(dateInMonth('2027-02', 31)).toBe('2027-02-28')
    expect(addMonthsToDate('2026-10-31', 1)).toBe('2026-11-30')
  })
})

describe('recorrentes', () => {
  it('gera ocorrências mensais, semanais e anuais', () => {
    expect(occurrencesInMonth(rec({ day: 31 }), '2026-09')).toEqual(['2026-09-30'])
    // Setembro de 2026 tem quatro sábados: 5, 12, 19 e 26.
    expect(occurrencesInMonth(rec({ frequency: 'weekly', weekday: 6 }), '2026-09')).toEqual([
      '2026-09-05', '2026-09-12', '2026-09-19', '2026-09-26',
    ])
    const yearly = rec({ frequency: 'yearly', month: 1, day: 20 })
    expect(occurrencesInMonth(yearly, '2026-09')).toEqual([])
    expect(occurrencesInMonth(yearly, '2027-01')).toEqual(['2027-01-20'])
  })

  it('respeita início e fim', () => {
    const r = rec({ start_date: '2026-09-11', end_date: '2026-11-30' })
    expect(occurrencesInMonth(r, '2026-09')).toEqual([])
    expect(occurrencesInMonth(r, '2026-10')).toEqual(['2026-10-10'])
    expect(occurrencesInMonth(r, '2026-12')).toEqual([])
  })

  it('só projeta meses ainda não gerados', () => {
    const list = [rec({ generated_until: '2026-09' })]
    expect(virtualRecurring(list, '2026-09', TODAY)).toHaveLength(0)
    expect(virtualRecurring(list, '2026-10', TODAY)).toHaveLength(1)
    expect(virtualRecurring([rec({ active: false })], '2026-10', TODAY)).toHaveLength(0)
  })
})

describe('resumo do mês', () => {
  const d = data({
    cards: [card],
    transactions: [
      tx({ type: 'income', amount_cents: 800_000, date: '2026-09-01' }),
      tx({ amount_cents: 200_000, date: '2026-09-05' }),
      // compra no cartão já feita: conta como gasto mesmo sem a fatura paga
      tx({ amount_cents: 50_000, date: '2026-09-10', card_id: 'card', paid: false }),
      // conta pendente: previsão, não gasto
      tx({ amount_cents: 30_000, date: '2026-09-25', paid: false }),
      // parcela futura no cartão: previsão
      tx({ amount_cents: 20_000, date: '2026-09-28', card_id: 'card', paid: false }),
      tx({ amount_cents: 99_999, date: '2026-08-20' }),
    ],
    recurring: [rec({ generated_until: '2026-09' })],
  })

  it('separa realizado de previsto', () => {
    const s = summarize(d, '2026-09', TODAY)
    expect(s.income).toBe(800_000)
    expect(s.expense).toBe(250_000)
    expect(s.balance).toBe(550_000)
    expect(s.pendingExpense).toBe(50_000)
    expect(s.projected).toBe(500_000)
    expect(s.savingsRate).toBeCloseTo(0.6875)
  })

  it('inclui recorrentes projetados em meses futuros', () => {
    const s = summarize(d, '2026-10', TODAY)
    expect(s.expense).toBe(0)
    expect(s.pendingExpense).toBe(10_000)
  })

  it('distribui a renda em fatias que somam 100%', () => {
    const { slices, base: total } = incomeDistribution(d, '2026-09', TODAY)
    expect(total).toBe(800_000)
    expect(slices.reduce((sum, s) => sum + s.value, 0)).toBe(800_000)
    expect(slices.at(-1)).toMatchObject({ key: 'savings', value: 550_000 })
  })
})

describe('cartões', () => {
  it('define a fatura pela data de fechamento', () => {
    expect(invoiceKeyOf('2026-09-13', 13)).toBe('2026-09')
    expect(invoiceKeyOf('2026-09-14', 13)).toBe('2026-10')
    expect(invoiceKeyOf('2026-12-20', 13)).toBe('2027-01')
    // fechamento dia 31 em mês de 30 dias fecha no dia 30
    expect(invoiceKeyOf('2026-09-30', 31)).toBe('2026-09')
  })

  it('calcula o vencimento antes ou depois da virada do mês', () => {
    expect(invoiceDueDate('2026-09', { closing_day: 13, due_day: 20 })).toBe('2026-09-20')
    expect(invoiceDueDate('2026-09', { closing_day: 28, due_day: 5 })).toBe('2026-10-05')
  })

  it('soma o limite utilizado e separa as faturas', () => {
    const d = data({
      cards: [card],
      transactions: [
        tx({ amount_cents: 10_000, date: '2026-08-10', card_id: 'card', paid: true }),
        tx({ amount_cents: 30_000, date: '2026-09-10', card_id: 'card', paid: false }),
        tx({ amount_cents: 30_000, date: '2026-10-10', card_id: 'card', paid: false }),
      ],
    })
    expect(cardUsage(d, card)).toMatchObject({ used: 60_000, available: 740_000 })
    const invoices = cardInvoices(d, card, TODAY)
    // dia 15: a fatura de setembro já fechou (dia 13) e a aberta é a de outubro
    expect(invoices.map((i) => [i.key, i.status])).toEqual([
      ['2026-08', 'paid'],
      ['2026-09', 'closed'],
      ['2026-10', 'open'],
    ])
  })
})

describe('contas', () => {
  it('transferências e aportes movem saldo sem virar receita ou despesa', () => {
    const account = (id: string, initial: number) => ({ ...base, id, name: id, type: 'checking' as const, initial_balance_cents: initial, color: 'blue' as const })
    const d = data({
      accounts: [account('a', 100_000), account('b', 0)],
      transactions: [
        tx({ type: 'income', amount_cents: 50_000, date: '2026-09-01', account_id: 'a' }),
        tx({ amount_cents: 20_000, date: '2026-09-02', account_id: 'a' }),
        tx({ amount_cents: 99_000, date: '2026-09-20', account_id: 'a', paid: false }),
      ],
      transfers: [{ ...base, id: 't', from_account_id: 'a', to_account_id: 'b', amount_cents: 30_000, date: '2026-09-03', note: null }],
      contributions: [{ ...base, id: 'c', goal_id: 'g', amount_cents: 10_000, date: '2026-09-04', account_id: 'a', note: null }],
    })
    const balances = accountBalances(d)
    expect(balances.get('a')).toBe(90_000)
    expect(balances.get('b')).toBe(30_000)
    expect(summarize(d, '2026-09', TODAY)).toMatchObject({ income: 50_000, expense: 20_000 })
  })
})

describe('orçamento, metas e alertas', () => {
  const category = { ...base, id: 'food', name: 'Alimentação', icon: 'utensils', color: 'orange' as const, type: 'expense' as const, parent_id: null }
  const sub = { ...category, id: 'delivery', name: 'Delivery', parent_id: 'food' }
  const goal = { ...base, id: 'g', name: 'Viagem', target_cents: 1_000_000, target_date: null, icon: 'plane', color: 'blue' as const, kind: 'goal' as const }

  const d = data({
    categories: [category, sub],
    budgets: [{ ...base, id: 'b', category_id: 'food', limit_cents: 100_000 }],
    goals: [goal],
    transactions: [
      tx({ type: 'income', amount_cents: 500_000, date: '2026-09-01' }),
      tx({ amount_cents: 60_000, date: '2026-09-03', category_id: 'food' }),
      tx({ amount_cents: 25_000, date: '2026-09-04', category_id: 'delivery' }),
    ],
    contributions: [
      { ...base, id: 'c1', goal_id: 'g', amount_cents: 400_000, date: '2026-01-10', account_id: null, note: null },
      { ...base, id: 'c2', goal_id: 'g', amount_cents: 150_000, date: '2026-08-10', account_id: null, note: null },
      { ...base, id: 'c3', goal_id: 'g', amount_cents: 150_000, date: '2026-09-10', account_id: null, note: null },
    ],
  })

  it('soma subcategorias no limite da categoria principal e alerta em 80%', () => {
    const [status] = budgetStatuses(d, '2026-09', TODAY)
    expect(status).toMatchObject({ spent: 85_000, remaining: 15_000, level: 'warn' })
    expect(buildNotifications(d, TODAY).some((n) => n.key.startsWith('budget:b:2026-09:warn'))).toBe(true)
  })

  it('prevê a conclusão da meta pelo ritmo dos últimos 90 dias', () => {
    const status = goalStatus(d, goal, TODAY)
    expect(status.saved).toBe(700_000)
    expect(status.monthlyPace).toBe(100_000)
    expect(status.monthsLeft).toBe(3)
    expect(status.eta).toBe('2026-12')
  })

  it('gera insights a partir dos dados', () => {
    const texts = monthInsights(d, '2026-09', TODAY).map((i) => i.text)
    expect(texts).toContain('Você economizou 83% da sua renda neste mês até agora.')
    expect(texts.some((t) => t.includes('sua meta Viagem será atingida em aproximadamente 3 meses'))).toBe(true)
  })

  it('não repete alertas dispensados', () => {
    const [first] = buildNotifications(d, TODAY)
    const dismissed = data({ ...d, notifications: [{ ...base, id: 'n', key: first.key, dismissed_at: '' }] })
    expect(buildNotifications(dismissed, TODAY).some((n) => n.key === first.key)).toBe(false)
  })
})

describe('despesas futuras', () => {
  it('agrupa compromissos por mês e por tipo', () => {
    const d = data({
      cards: [card],
      recurring: [
        rec({ amount_cents: 45_000, generated_until: '2026-09' }),
        rec({ type: 'income', amount_cents: 800_000, day: 5, generated_until: '2026-09' }),
      ],
      transactions: [
        // parcela de outubro
        tx({ amount_cents: 30_000, date: '2026-10-10', card_id: 'card', paid: false, installment_id: 'i' }),
        // compra avulsa de 14/09: fatura de outubro, que vence em 20/10
        tx({ amount_cents: 12_000, date: '2026-09-14', card_id: 'card', paid: false }),
      ],
    })
    const [september, october] = futureCommitments(d, '2026-09', 2, TODAY)
    expect(september.total).toBe(0)
    expect(october).toMatchObject({ fixed: 45_000, installments: 30_000, cards: 12_000, total: 87_000 })
    expect(october.share).toBeCloseTo(87_000 / 800_000)
  })
})
