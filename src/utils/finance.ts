import type {
  Budget,
  Category,
  CreditCard,
  FinanceData,
  Goal,
  Installment,
  ISODate,
  MonthKey,
  MonthlyPlan,
  Transaction,
} from '@/types'
import {
  addDays,
  addMonths,
  dateInMonth,
  dayOf,
  daysInMonth,
  endOfMonth,
  lastMonths,
  monthDiff,
  monthOf,
  monthShort,
  monthsFrom,
  todayISO,
} from './date'
import { colorVar } from './labels'
import { ratio, sumBy } from './money'
import { monthlyEquivalent, virtualRecurring } from './recurring'

/* ------------------------------------------------------------------ */
/* Categorias                                                          */
/* ------------------------------------------------------------------ */

export interface CategoryIndex {
  byId: Map<string, Category>
  roots: Category[]
  childrenOf: (id: string) => Category[]
  rootOf: (id: string | null) => Category | null
  /** "Alimentação › Delivery" */
  pathOf: (id: string | null) => string
}

const indexCache = new WeakMap<readonly Category[], CategoryIndex>()

export function categoryIndex(categories: readonly Category[]): CategoryIndex {
  const cached = indexCache.get(categories)
  if (cached) return cached

  const byId = new Map(categories.map((c) => [c.id, c]))
  const children = new Map<string, Category[]>()
  for (const c of categories) {
    if (!c.parent_id) continue
    const list = children.get(c.parent_id) ?? []
    list.push(c)
    children.set(c.parent_id, list)
  }
  const rootOf = (id: string | null) => {
    const cat = id ? byId.get(id) : undefined
    if (!cat) return null
    return (cat.parent_id && byId.get(cat.parent_id)) || cat
  }
  const index: CategoryIndex = {
    byId,
    roots: categories.filter((c) => !c.parent_id || !byId.has(c.parent_id)),
    childrenOf: (id) => children.get(id) ?? [],
    rootOf,
    pathOf: (id) => {
      const cat = id ? byId.get(id) : undefined
      if (!cat) return 'Sem categoria'
      const root = rootOf(id)
      return root && root.id !== cat.id ? `${root.name} › ${cat.name}` : cat.name
    },
  }
  indexCache.set(categories, index)
  return index
}

/* ------------------------------------------------------------------ */
/* Lançamentos e resumo do mês                                         */
/* ------------------------------------------------------------------ */

/**
 * Um lançamento conta como realizado quando está pago ou quando é uma compra
 * no cartão já feita (o gasto aconteceu, mesmo que a fatura ainda não tenha
 * sido paga). Todo o resto é previsão.
 */
export function isRealized(t: Transaction, today: ISODate): boolean {
  if (t.virtual) return false
  return t.paid || (t.card_id !== null && t.date <= today)
}

/** Lançamentos do mês, incluindo as ocorrências previstas de recorrentes. */
export function transactionsOfMonth(
  data: FinanceData,
  month: MonthKey,
  today: ISODate = todayISO(),
): Transaction[] {
  const real = data.transactions.filter((t) => t.date.startsWith(month))
  return [...real, ...virtualRecurring(data.recurring, month, today)]
}

export interface MonthSummary {
  month: MonthKey
  income: number
  expense: number
  /** Receitas − despesas realizadas. */
  balance: number
  /** Parte da renda que sobrou (pode ser negativa). */
  savingsRate: number
  pendingIncome: number
  pendingExpense: number
  /** Saldo esperado no fim do mês, contando o que ainda está previsto. */
  projected: number
}

/**
 * Resumo do mês. `untilDay` limita ao período do dia 1 até aquele dia — usado
 * para comparar um mês em andamento com o mesmo trecho do mês anterior.
 */
export function summarize(
  data: FinanceData,
  month: MonthKey,
  today: ISODate = todayISO(),
  untilDay?: number,
): MonthSummary {
  let income = 0
  let expense = 0
  let pendingIncome = 0
  let pendingExpense = 0
  for (const t of transactionsOfMonth(data, month, today)) {
    if (untilDay !== undefined && dayOf(t.date) > untilDay) continue
    const realized = isRealized(t, today)
    if (t.type === 'income') {
      if (realized) income += t.amount_cents
      else pendingIncome += t.amount_cents
    } else if (realized) expense += t.amount_cents
    else pendingExpense += t.amount_cents
  }
  const balance = income - expense
  return {
    month,
    income,
    expense,
    balance,
    savingsRate: ratio(balance, income),
    pendingIncome,
    pendingExpense,
    projected: balance + pendingIncome - pendingExpense,
  }
}

export interface CategoryTotal {
  id: string
  category: Category | null
  total: number
}

export function expensesByCategory(
  data: FinanceData,
  month: MonthKey,
  today: ISODate = todayISO(),
  opts: { level?: 'root' | 'leaf'; untilDay?: number; includePending?: boolean } = {},
): CategoryTotal[] {
  const index = categoryIndex(data.categories)
  const totals = new Map<string, CategoryTotal>()
  for (const t of transactionsOfMonth(data, month, today)) {
    if (t.type !== 'expense') continue
    if (!opts.includePending && !isRealized(t, today)) continue
    if (opts.untilDay !== undefined && dayOf(t.date) > opts.untilDay) continue
    const category =
      opts.level === 'leaf' ? (index.byId.get(t.category_id ?? '') ?? null) : index.rootOf(t.category_id)
    const id = category?.id ?? 'none'
    const entry = totals.get(id) ?? { id, category, total: 0 }
    entry.total += t.amount_cents
    totals.set(id, entry)
  }
  return [...totals.values()].sort((a, b) => b.total - a.total)
}

export interface Slice {
  key: string
  label: string
  color: string
  value: number
  share: number
}

/**
 * Como a renda do mês foi distribuída: uma fatia por categoria de despesa e
 * uma fatia "Economia" com o que sobrou. As menores categorias viram "Outros".
 */
export function incomeDistribution(
  data: FinanceData,
  month: MonthKey,
  today: ISODate = todayISO(),
  maxCategories = 7,
): { base: number; income: number; slices: Slice[] } {
  const summary = summarize(data, month, today)
  const byCategory = expensesByCategory(data, month, today)
  const base = Math.max(summary.income, summary.expense)

  const head = byCategory.slice(0, maxCategories)
  const tail = byCategory.slice(maxCategories)
  const slices: Slice[] = head.map((c) => ({
    key: c.id,
    label: c.category?.name ?? 'Sem categoria',
    color: colorVar(c.category?.color),
    value: c.total,
    share: ratio(c.total, base),
  }))
  const rest = sumBy(tail, (c) => c.total)
  if (rest > 0) {
    slices.push({
      key: 'rest',
      label: 'Demais categorias',
      color: colorVar('gray'),
      value: rest,
      share: ratio(rest, base),
    })
  }
  if (summary.balance > 0) {
    slices.push({
      key: 'savings',
      label: 'Economia',
      color: 'var(--series-neutral)',
      value: summary.balance,
      share: ratio(summary.balance, base),
    })
  }
  return { base, income: summary.income, slices }
}

export interface SeriesPoint {
  month: MonthKey
  label: string
  income: number
  expense: number
  savings: number
  savingsRate: number
}

export function monthlySeries(
  data: FinanceData,
  end: MonthKey,
  count: number,
  today: ISODate = todayISO(),
): SeriesPoint[] {
  return lastMonths(end, count).map((month) => {
    const s = summarize(data, month, today)
    return {
      month,
      label: monthShort(month),
      income: s.income,
      expense: s.expense,
      savings: s.balance,
      savingsRate: s.savingsRate,
    }
  })
}

/* ------------------------------------------------------------------ */
/* Renda e gastos fixos                                                */
/* ------------------------------------------------------------------ */

/** Renda mensal cadastrada (salário, renda extra…), em valor mensal. */
export function expectedIncome(data: FinanceData): number {
  return sumBy(
    data.recurring.filter((r) => r.active && r.type === 'income'),
    monthlyEquivalent,
  )
}

export function fixedMonthlyTotal(data: FinanceData): number {
  return sumBy(
    data.recurring.filter((r) => r.active && r.type === 'expense'),
    monthlyEquivalent,
  )
}

/**
 * Renda usada como referência para percentuais: o que entrou (ou está previsto)
 * no mês; se o mês não tem receita nenhuma, a renda mensal cadastrada.
 */
export function referenceIncome(data: FinanceData, month: MonthKey, today: ISODate = todayISO()): number {
  const s = summarize(data, month, today)
  return s.income + s.pendingIncome || expectedIncome(data)
}

/** Média das despesas realizadas nos últimos meses completos que têm dados. */
export function averageMonthlyExpense(data: FinanceData, today: ISODate = todayISO(), months = 3): number {
  const totals = lastMonths(addMonths(monthOf(today), -1), months)
    .map((m) => summarize(data, m, today).expense)
    .filter((v) => v > 0)
  if (totals.length > 0) return Math.round(sumBy(totals, (v) => v) / totals.length)
  const current = summarize(data, monthOf(today), today)
  return current.expense + current.pendingExpense
}

export function averageMonthlySavings(data: FinanceData, today: ISODate = todayISO(), months = 3): number {
  const list = lastMonths(addMonths(monthOf(today), -1), months)
    .map((m) => summarize(data, m, today))
    .filter((s) => s.income > 0 || s.expense > 0)
  return list.length ? Math.round(sumBy(list, (s) => s.balance) / list.length) : 0
}

/* ------------------------------------------------------------------ */
/* Contas e patrimônio                                                 */
/* ------------------------------------------------------------------ */

/**
 * Saldo de cada conta: saldo inicial + receitas pagas − despesas pagas
 * ± transferências − aportes em metas. `upTo` calcula o saldo em uma data.
 */
export function accountBalances(data: FinanceData, upTo?: ISODate): Map<string, number> {
  const balances = new Map(data.accounts.map((a) => [a.id, a.initial_balance_cents]))
  const add = (id: string | null, value: number) => {
    if (id && balances.has(id)) balances.set(id, balances.get(id)! + value)
  }
  const within = (date: ISODate) => !upTo || date <= upTo

  for (const t of data.transactions) {
    if (!t.paid || !within(t.date)) continue
    add(t.account_id, t.type === 'income' ? t.amount_cents : -t.amount_cents)
  }
  for (const t of data.transfers) {
    if (!within(t.date)) continue
    add(t.from_account_id, -t.amount_cents)
    add(t.to_account_id, t.amount_cents)
  }
  for (const c of data.contributions) {
    if (within(c.date)) add(c.account_id, -c.amount_cents)
  }
  return balances
}

export function goalSaved(data: FinanceData, goalId: string, upTo?: ISODate): number {
  return sumBy(
    data.contributions.filter((c) => c.goal_id === goalId && (!upTo || c.date <= upTo)),
    (c) => c.amount_cents,
  )
}

export interface NetWorth {
  accounts: number
  investments: number
  reserve: number
  goals: number
  total: number
}

export function netWorthAt(data: FinanceData, upTo?: ISODate): NetWorth {
  const balances = accountBalances(data, upTo)
  let accounts = 0
  let investments = 0
  for (const a of data.accounts) {
    const value = balances.get(a.id) ?? 0
    if (a.type === 'investment') investments += value
    else accounts += value
  }
  let reserve = 0
  let goals = 0
  for (const g of data.goals) {
    const saved = goalSaved(data, g.id, upTo)
    if (g.kind === 'emergency') reserve += saved
    else goals += saved
  }
  return { accounts, investments, reserve, goals, total: accounts + investments + reserve + goals }
}

export function netWorthSeries(data: FinanceData, end: MonthKey, count: number) {
  return lastMonths(end, count).map((month) => ({
    month,
    label: monthShort(month),
    ...netWorthAt(data, endOfMonth(month)),
  }))
}

/* ------------------------------------------------------------------ */
/* Cartões                                                             */
/* ------------------------------------------------------------------ */

/** Mês da fatura em que uma compra cai: depois do fechamento, vai para a próxima. */
export function invoiceKeyOf(date: ISODate, closingDay: number): MonthKey {
  const month = monthOf(date)
  return dayOf(date) > Math.min(closingDay, daysInMonth(month)) ? addMonths(month, 1) : month
}

export function invoiceDueDate(key: MonthKey, card: Pick<CreditCard, 'closing_day' | 'due_day'>): ISODate {
  return card.due_day > card.closing_day
    ? dateInMonth(key, card.due_day)
    : dateInMonth(addMonths(key, 1), card.due_day)
}

export type InvoiceStatus = 'paid' | 'open' | 'closed' | 'overdue' | 'future'

export interface Invoice {
  key: MonthKey
  card: CreditCard
  items: Transaction[]
  total: number
  closingDate: ISODate
  dueDate: ISODate
  status: InvoiceStatus
}

const signed = (t: Transaction) => (t.type === 'expense' ? t.amount_cents : -t.amount_cents)

export function cardInvoices(data: FinanceData, card: CreditCard, today: ISODate = todayISO()): Invoice[] {
  const groups = new Map<MonthKey, Transaction[]>()
  for (const t of data.transactions) {
    if (t.card_id !== card.id) continue
    const key = invoiceKeyOf(t.date, card.closing_day)
    const list = groups.get(key) ?? []
    list.push(t)
    groups.set(key, list)
  }
  const currentKey = invoiceKeyOf(today, card.closing_day)
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, items]) => {
      const dueDate = invoiceDueDate(key, card)
      let status: InvoiceStatus
      if (items.every((t) => t.paid)) status = 'paid'
      else if (key > currentKey) status = 'future'
      else if (key === currentKey) status = 'open'
      else status = dueDate < today ? 'overdue' : 'closed'
      return {
        key,
        card,
        items: items.sort((a, b) => b.date.localeCompare(a.date)),
        total: sumBy(items, signed),
        closingDate: dateInMonth(key, card.closing_day),
        dueDate,
        status,
      }
    })
}

/** Limite utilizado: tudo que está no cartão e ainda não foi pago, inclusive parcelas futuras. */
export function cardUsage(data: FinanceData, card: CreditCard) {
  const used = Math.max(
    0,
    sumBy(
      data.transactions.filter((t) => t.card_id === card.id && !t.paid),
      signed,
    ),
  )
  return { used, available: card.limit_cents - used, pct: ratio(used, card.limit_cents) }
}

export function totalCardUsage(data: FinanceData) {
  const used = sumBy(data.cards, (c) => cardUsage(data, c).used)
  const limit = sumBy(data.cards, (c) => c.limit_cents)
  return { used, limit, pct: ratio(used, limit) }
}

/* ------------------------------------------------------------------ */
/* Parcelamentos                                                       */
/* ------------------------------------------------------------------ */

export interface InstallmentStatus {
  installment: Installment
  items: Transaction[]
  /** Valor da parcela (a mais comum; a primeira pode carregar os centavos). */
  parcel: number
  /** Parcela do mês corrente (ou a última já vencida). */
  current: number
  remainingCount: number
  remainingAmount: number
  finished: boolean
  lastDate: ISODate
}

export function installmentStatus(
  data: FinanceData,
  installment: Installment,
  today: ISODate = todayISO(),
): InstallmentStatus {
  const items = data.transactions
    .filter((t) => t.installment_id === installment.id)
    .sort((a, b) => (a.installment_number ?? 0) - (b.installment_number ?? 0))
  const endOfCurrent = endOfMonth(monthOf(today))
  // Parcela "em aberto" é a que ainda não venceu neste mês e não está paga.
  const ahead = items.filter((t) => t.date > endOfCurrent && !t.paid)
  const reached = items.filter((t) => t.date <= endOfCurrent)
  const unpaid = items.filter((t) => !t.paid)
  return {
    installment,
    items,
    parcel: items.at(-1)?.amount_cents ?? Math.round(installment.total_cents / installment.count),
    current: reached.at(-1)?.installment_number ?? 0,
    remainingCount: unpaid.length,
    remainingAmount: sumBy(unpaid, (t) => t.amount_cents),
    finished: unpaid.length === 0 && ahead.length === 0,
    lastDate: items.at(-1)?.date ?? installment.first_date,
  }
}

/* ------------------------------------------------------------------ */
/* Orçamento e planejamento                                            */
/* ------------------------------------------------------------------ */

/** Gasto realizado em uma categoria, somando suas subcategorias. */
export function spentInCategory(
  data: FinanceData,
  categoryId: string,
  month: MonthKey,
  today: ISODate = todayISO(),
): number {
  const index = categoryIndex(data.categories)
  const ids = new Set([categoryId, ...index.childrenOf(categoryId).map((c) => c.id)])
  return sumBy(
    data.transactions.filter(
      (t) =>
        t.type === 'expense' &&
        t.date.startsWith(month) &&
        t.category_id !== null &&
        ids.has(t.category_id) &&
        isRealized(t, today),
    ),
    (t) => t.amount_cents,
  )
}

export type BudgetLevel = 'ok' | 'warn' | 'over'

export interface BudgetStatus {
  budget: Budget
  category: Category | null
  spent: number
  remaining: number
  pct: number
  level: BudgetLevel
}

export const budgetLevel = (pct: number): BudgetLevel => (pct > 1 ? 'over' : pct >= 0.8 ? 'warn' : 'ok')

export function budgetStatuses(data: FinanceData, month: MonthKey, today: ISODate = todayISO()): BudgetStatus[] {
  const index = categoryIndex(data.categories)
  return data.budgets
    .map((budget) => {
      const spent = spentInCategory(data, budget.category_id, month, today)
      const pct = ratio(spent, budget.limit_cents)
      return {
        budget,
        category: index.byId.get(budget.category_id) ?? null,
        spent,
        remaining: budget.limit_cents - spent,
        pct,
        level: budgetLevel(pct),
      }
    })
    .sort((a, b) => b.pct - a.pct)
}

export interface PlanRow {
  key: string
  label: string
  planned: number
  actual: number | null
}

/** Planejado x realizado: só linhas ligadas a uma categoria têm realizado. */
export function planVersusActual(
  data: FinanceData,
  plan: MonthlyPlan,
  today: ISODate = todayISO(),
): PlanRow[] {
  return plan.allocations.map((a) => ({
    key: a.key,
    label: a.label,
    planned: a.amount_cents,
    actual: a.category_id ? spentInCategory(data, a.category_id, plan.month, today) : null,
  }))
}

/* ------------------------------------------------------------------ */
/* Metas e reserva de emergência                                       */
/* ------------------------------------------------------------------ */

export interface GoalStatus {
  goal: Goal
  saved: number
  remaining: number
  pct: number
  done: boolean
  /** Média mensal de aportes nos últimos 90 dias. */
  monthlyPace: number
  monthsLeft: number | null
  eta: MonthKey | null
}

export function goalStatus(data: FinanceData, goal: Goal, today: ISODate = todayISO()): GoalStatus {
  const saved = goalSaved(data, goal.id)
  const remaining = Math.max(0, goal.target_cents - saved)
  const since = addDays(today, -90)
  const recent = sumBy(
    data.contributions.filter((c) => c.goal_id === goal.id && c.date > since && c.date <= today),
    (c) => c.amount_cents,
  )
  const monthlyPace = Math.max(0, Math.round(recent / 3))
  const monthsLeft = remaining === 0 ? 0 : monthlyPace > 0 ? Math.ceil(remaining / monthlyPace) : null
  return {
    goal,
    saved,
    remaining,
    pct: ratio(saved, goal.target_cents),
    done: remaining === 0 && goal.target_cents > 0,
    monthlyPace,
    monthsLeft,
    eta: monthsLeft === null ? null : addMonths(monthOf(today), monthsLeft),
  }
}

export function emergencyReserve(data: FinanceData, today: ISODate = todayISO()) {
  const goals = data.goals.filter((g) => g.kind === 'emergency')
  const amount = sumBy(goals, (g) => goalSaved(data, g.id))
  const averageExpense = averageMonthlyExpense(data, today)
  return {
    exists: goals.length > 0,
    amount,
    averageExpense,
    months: averageExpense > 0 ? amount / averageExpense : 0,
  }
}

/* ------------------------------------------------------------------ */
/* Compromissos futuros e calendário                                   */
/* ------------------------------------------------------------------ */

export interface Commitment {
  month: MonthKey
  cards: number
  installments: number
  fixed: number
  others: number
  total: number
  expectedIncome: number
  share: number
}

/**
 * Despesas já conhecidas dos próximos meses. Compras avulsas no cartão entram
 * no mês em que a fatura vence; o restante, no mês da própria data.
 */
export function futureCommitments(
  data: FinanceData,
  from: MonthKey,
  count: number,
  today: ISODate = todayISO(),
): Commitment[] {
  const months = monthsFrom(from, count)
  const rows = new Map<MonthKey, Commitment>(
    months.map((month) => [
      month,
      { month, cards: 0, installments: 0, fixed: 0, others: 0, total: 0, expectedIncome: 0, share: 0 },
    ]),
  )
  const cardById = new Map(data.cards.map((c) => [c.id, c]))
  const pending = [
    ...data.transactions.filter((t) => t.type === 'expense' && !t.paid),
    ...months.flatMap((m) => virtualRecurring(data.recurring, m, today).filter((t) => t.type === 'expense')),
  ]
  for (const t of pending) {
    const card = t.card_id ? cardById.get(t.card_id) : undefined
    const loose = card && !t.installment_id && !t.recurring_id
    const month = loose ? monthOf(invoiceDueDate(invoiceKeyOf(t.date, card.closing_day), card)) : monthOf(t.date)
    const row = rows.get(month)
    if (!row) continue
    if (t.installment_id) row.installments += t.amount_cents
    else if (t.recurring_id) row.fixed += t.amount_cents
    else if (card) row.cards += t.amount_cents
    else row.others += t.amount_cents
  }
  const income = expectedIncome(data)
  return months.map((month) => {
    const row = rows.get(month)!
    row.total = row.cards + row.installments + row.fixed + row.others
    row.expectedIncome = income
    row.share = ratio(row.total, income)
    return row
  })
}

export type CalendarKind = 'income' | 'expense' | 'fixed' | 'installment' | 'invoice'

export interface CalendarItem {
  id: string
  date: ISODate
  label: string
  amount: number
  kind: CalendarKind
  done: boolean
  /** Lançamento de origem, quando o item pode ser marcado como pago. */
  transaction?: Transaction
  cardId?: string
}

/** Itens do calendário: contas e receitas na própria data, cartões no vencimento da fatura. */
export function calendarItems(data: FinanceData, month: MonthKey, today: ISODate = todayISO()): CalendarItem[] {
  const items: CalendarItem[] = []
  for (const t of transactionsOfMonth(data, month, today)) {
    if (t.card_id) continue
    const kind: CalendarKind =
      t.type === 'income' ? 'income' : t.installment_id ? 'installment' : t.recurring_id ? 'fixed' : 'expense'
    items.push({
      id: t.id,
      date: t.date,
      label:
        t.installment_number && t.installment_total
          ? `${t.description} ${t.installment_number}/${t.installment_total}`
          : t.description,
      amount: t.amount_cents,
      kind,
      done: isRealized(t, today),
      transaction: t.virtual ? undefined : t,
    })
  }
  for (const card of data.cards) {
    for (const invoice of cardInvoices(data, card, today)) {
      if (monthOf(invoice.dueDate) !== month || invoice.total <= 0) continue
      items.push({
        id: `invoice:${card.id}:${invoice.key}`,
        date: invoice.dueDate,
        label: `Fatura ${card.name}`,
        amount: invoice.total,
        kind: 'invoice',
        done: invoice.status === 'paid',
        cardId: card.id,
      })
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount)
}

/** Contas a pagar em aberto: as atrasadas e as que vencem nos próximos `days` dias. */
export function upcomingBills(data: FinanceData, today: ISODate = todayISO(), days = 30): CalendarItem[] {
  const limit = addDays(today, days)
  const months = monthsFrom(addMonths(monthOf(today), -2), monthDiff(monthOf(today), monthOf(limit)) + 3)
  return months
    .flatMap((m) => calendarItems(data, m, today))
    .filter((i) => i.kind !== 'income' && !i.done && i.date <= limit)
}

/* ------------------------------------------------------------------ */
/* Saúde financeira                                                    */
/* ------------------------------------------------------------------ */

export type HealthStatus = 'good' | 'attention' | 'critical' | 'neutral'

export interface HealthIndicator {
  key: 'fixed' | 'savings' | 'cards' | 'trend' | 'reserve'
  label: string
  value: string
  detail: string
  status: HealthStatus
  /** Preenchimento da barra, de 0 a 1 (quando faz sentido). */
  fill: number | null
}

const pctText = (value: number, digits = 0) =>
  `${(value * 100).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`

export function healthIndicators(
  data: FinanceData,
  month: MonthKey,
  today: ISODate = todayISO(),
): HealthIndicator[] {
  const income = referenceIncome(data, month, today)
  const summary = summarize(data, month, today)
  const out: HealthIndicator[] = []

  const fixedShare = ratio(fixedMonthlyTotal(data), income)
  out.push({
    key: 'fixed',
    label: 'Gastos fixos',
    value: income > 0 ? `${pctText(fixedShare)} da renda` : '—',
    detail:
      income === 0
        ? 'Cadastre sua renda para calcular.'
        : fixedShare <= 0.5
          ? 'Dentro do recomendado (até 50%).'
          : 'Acima de 50% da renda: pouco espaço para imprevistos.',
    status: income === 0 ? 'neutral' : fixedShare <= 0.5 ? 'good' : fixedShare <= 0.65 ? 'attention' : 'critical',
    fill: income > 0 ? Math.min(1, fixedShare) : null,
  })

  // No mês em andamento a economia "até agora" engana (as contas ainda vão
  // vencer), então o indicador usa a projeção para o fim do mês.
  const ongoing = month === monthOf(today)
  const monthIncome = ongoing ? summary.income + summary.pendingIncome : summary.income
  const rate = ongoing ? ratio(summary.projected, monthIncome) : summary.savingsRate
  out.push({
    key: 'savings',
    label: ongoing ? 'Economia projetada' : 'Economia',
    value: monthIncome > 0 ? `${pctText(rate)} da renda` : '—',
    detail:
      monthIncome === 0
        ? 'Nenhuma receita neste mês ainda.'
        : rate >= 0.2
          ? 'Ótimo ritmo: 20% ou mais da renda guardada.'
          : rate >= 0.1
            ? 'Bom começo; a referência é guardar 20%.'
            : rate >= 0
              ? 'Abaixo de 10% da renda.'
              : 'As despesas superam as receitas.',
    status: monthIncome === 0 ? 'neutral' : rate >= 0.2 ? 'good' : rate >= 0.1 ? 'attention' : 'critical',
    fill: monthIncome > 0 ? Math.max(0, Math.min(1, rate)) : null,
  })

  const cards = totalCardUsage(data)
  out.push({
    key: 'cards',
    label: 'Cartões',
    value: cards.limit > 0 ? `${pctText(cards.pct)} do limite utilizado` : '—',
    detail:
      cards.limit === 0
        ? 'Nenhum cartão cadastrado.'
        : cards.pct <= 0.3
          ? 'Uso confortável do limite.'
          : cards.pct <= 0.6
            ? 'Uso moderado; acompanhe as próximas faturas.'
            : 'Limite muito comprometido.',
    status: cards.limit === 0 ? 'neutral' : cards.pct <= 0.3 ? 'good' : cards.pct <= 0.6 ? 'attention' : 'critical',
    fill: cards.limit > 0 ? Math.min(1, cards.pct) : null,
  })

  // Evolução das despesas: compara sempre dois meses fechados.
  const lastClosed = month >= monthOf(today) ? addMonths(monthOf(today), -1) : month
  const a = summarize(data, addMonths(lastClosed, -1), today).expense
  const b = summarize(data, lastClosed, today).expense
  const change = a > 0 ? (b - a) / a : 0
  out.push({
    key: 'trend',
    label: 'Evolução das despesas',
    value: a > 0 && b > 0 ? `${change > 0 ? '+' : ''}${pctText(change)}` : '—',
    detail:
      a > 0 && b > 0
        ? `${monthShort(lastClosed)} em relação a ${monthShort(addMonths(lastClosed, -1))}.`
        : 'Ainda não há dois meses fechados para comparar.',
    status: !(a > 0 && b > 0) ? 'neutral' : change <= 0 ? 'good' : change <= 0.1 ? 'attention' : 'critical',
    fill: null,
  })

  const reserve = emergencyReserve(data, today)
  out.push({
    key: 'reserve',
    label: 'Reserva de emergência',
    value: reserve.exists
      ? `${reserve.months.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} meses`
      : '—',
    detail: !reserve.exists
      ? 'Crie uma meta de reserva de emergência.'
      : reserve.months >= 6
        ? 'Cobre 6 meses ou mais dos seus gastos.'
        : reserve.months >= 3
          ? 'Cobre de 3 a 6 meses; o ideal é chegar a 6.'
          : 'Cobre menos de 3 meses dos seus gastos.',
    status: !reserve.exists
      ? 'neutral'
      : reserve.months >= 6
        ? 'good'
        : reserve.months >= 3
          ? 'attention'
          : 'critical',
    fill: reserve.exists ? Math.min(1, reserve.months / 6) : null,
  })

  return out
}
