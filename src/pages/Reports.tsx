import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowDownRight,
  ArrowUp,
  ArrowUpRight,
  ChartColumn,
  Crown,
  Minus,
  PiggyBank,
  Repeat,
  ShoppingBag,
} from 'lucide-react'
import { CategorySelect } from '@/components/CategorySelect'
import { FinancialChart, type ChartSeries } from '@/components/charts/FinancialChart'
import { EmptyState } from '@/components/EmptyState'
import { HealthPanel } from '@/components/HealthPanel'
import { MonthSelector } from '@/components/MonthSelector'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Card, CardHeader } from '@/components/ui/Card'
import { ProgressBar, Segmented } from '@/components/ui/Feedback'
import { Field, Input, Select } from '@/components/ui/Form'
import { useFinance } from '@/contexts/FinanceContext'
import { useMonth } from '@/contexts/MonthContext'
import { cn } from '@/lib/cn'
import type { FinanceData, ISODate, MonthKey } from '@/types'
import {
  addMonths,
  currentMonth,
  endOfMonth,
  lastMonths,
  monthDiff,
  monthLabel,
  monthLabelSlash,
  monthOf,
  monthShort,
  monthsFrom,
  startOfMonth,
  todayISO,
  yearOf,
} from '@/utils/date'
import {
  categoryIndex,
  expensesByCategory,
  healthIndicators,
  isRealized,
  netWorthSeries,
  planVersusActual,
  summarize,
} from '@/utils/finance'
import { colorVar } from '@/utils/labels'
import { formatBRL, formatPercent, ratio, sumBy } from '@/utils/money'

type Tab = 'overview' | 'compare'
type Period = 'month' | 'year' | 'custom'

const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'overview', label: 'Visão geral' },
  { value: 'compare', label: 'Comparar meses' },
]

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: 'month', label: 'Mês' },
  { value: 'year', label: 'Ano' },
  { value: 'custom', label: 'Personalizado' },
]

export default function Reports() {
  const [tab, setTab] = useState<Tab>('overview')
  return (
    <>
      <PageHeader title="Relatórios" subtitle="Análises do período, por categoria, conta e cartão." />
      <Segmented label="Relatório" value={tab} onChange={setTab} options={TABS} className="mb-6" />
      {tab === 'overview' ? <Overview /> : <Compare />}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Visão geral                                                         */
/* ------------------------------------------------------------------ */

const INCOME_EXPENSE: ChartSeries[] = [
  { key: 'income', label: 'Receitas', color: 'var(--series-income)' },
  { key: 'expense', label: 'Despesas', color: 'var(--series-expense)' },
]
const SAVINGS: ChartSeries[] = [{ key: 'savings', label: 'Economia', color: 'var(--series-savings)' }]
const WORTH: ChartSeries[] = [{ key: 'total', label: 'Patrimônio', color: 'var(--series-savings)', kind: 'area' }]
const PLAN: ChartSeries[] = [
  { key: 'planned', label: 'Planejado', color: 'var(--series-neutral)' },
  { key: 'actual', label: 'Realizado', color: 'var(--series-savings)' },
]

function Overview() {
  const data = useFinance()
  const { month } = useMonth()
  const today = todayISO()

  const [period, setPeriod] = useState<Period>('month')
  const [year, setYear] = useState(() => yearOf(currentMonth()))
  const [from, setFrom] = useState<ISODate>(() => startOfMonth(addMonths(currentMonth(), -2)))
  const [to, setTo] = useState<ISODate>(today)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [accountId, setAccountId] = useState('')
  const [cardId, setCardId] = useState('')

  const years = useMemo(() => {
    const set = new Set(data.transactions.map((t) => yearOf(t.date)))
    set.add(yearOf(currentMonth()))
    return [...set].sort((a, b) => b - a)
  }, [data.transactions])

  const range = useMemo(() => {
    if (period === 'month') return { start: startOfMonth(month), end: endOfMonth(month) }
    if (period === 'year') return { start: `${year}-01-01`, end: `${year}-12-31` }
    return from && to && from <= to ? { start: from, end: to } : { start: to || from, end: to || from }
  }, [period, month, year, from, to])

  const report = useMemo(() => {
    const index = categoryIndex(data.categories)
    const matches = (t: FinanceData['transactions'][number]) =>
      (!categoryId || t.category_id === categoryId || index.rootOf(t.category_id)?.id === categoryId) &&
      (!accountId || t.account_id === accountId) &&
      (!cardId || t.card_id === cardId)

    // Mesmos cálculos do resto do app, sobre um recorte dos lançamentos.
    // Recorrentes ficam de fora: o relatório olha só o que foi realizado.
    const filtered: FinanceData = { ...data, transactions: data.transactions.filter(matches), recurring: [] }
    const inRange: FinanceData = {
      ...filtered,
      transactions: filtered.transactions.filter((t) => t.date >= range.start && t.date <= range.end),
    }

    const first = monthOf(range.start)
    const span = monthDiff(first, monthOf(range.end)) + 1
    const months = monthsFrom(first, span)
    const totals = months.map((m) => summarize(inRange, m, today))
    const income = sumBy(totals, (s) => s.income)
    const expense = sumBy(totals, (s) => s.expense)

    const realized = inRange.transactions.filter((t) => t.type === 'expense' && isRealized(t, today))
    const fixed = sumBy(realized.filter((t) => t.recurring_id), (t) => t.amount_cents)

    const byCategory = new Map<string, { name: string; color: string; total: number }>()
    for (const m of months) {
      for (const c of expensesByCategory(inRange, m, today)) {
        const entry = byCategory.get(c.id) ?? {
          name: c.category?.name ?? 'Sem categoria',
          color: colorVar(c.category?.color),
          total: 0,
        }
        entry.total += c.total
        byCategory.set(c.id, entry)
      }
    }
    const categories = [...byCategory.values()].sort((a, b) => b.total - a.total)

    // Período de um mês só: o gráfico mostra os 6 meses até ele, para dar contexto.
    const chartMonths = span === 1 ? lastMonths(first, 6) : months
    const chartSource = span === 1 ? filtered : inRange
    const monthly = chartMonths.map((m) => {
      const s = summarize(chartSource, m, today)
      return { label: monthShort(m), income: s.income, expense: s.expense, savings: s.balance }
    })

    const planMonth = monthOf(range.end)
    const plan = data.plans.find((p) => p.month === planMonth)

    return {
      income,
      expense,
      savings: income - expense,
      rate: ratio(income - expense, income),
      fixed,
      variable: expense - fixed,
      categories,
      monthly,
      contextual: span === 1,
      plan: plan
        ? planVersusActual(data, plan, today)
            .filter((r) => r.actual !== null)
            .map((r) => ({ label: r.label, planned: r.planned, actual: r.actual }))
        : [],
      planMonth,
    }
  }, [data, range, categoryId, accountId, cardId, today])

  const worth = useMemo(
    () => netWorthSeries(data, monthOf(range.end) > currentMonth() ? currentMonth() : monthOf(range.end), 12).map(
      (p) => ({ label: p.label, total: p.total }),
    ),
    [data, range.end],
  )
  const health = useMemo(() => healthIndicators(data, monthOf(range.end), today), [data, range.end, today])

  const top = report.categories[0]
  const filtersActive = Boolean(categoryId || accountId || cardId)
  const empty = report.income === 0 && report.expense === 0

  return (
    <>
      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <Segmented label="Período" value={period} onChange={setPeriod} options={PERIODS} />
          {period === 'month' && <MonthSelector />}
          {period === 'year' && (
            <Select aria-label="Ano" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28">
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          )}
          {period === 'custom' && (
            <>
              <Field label="De" className="w-40">
                {(id) => <Input id={id} type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />}
              </Field>
              <Field label="Até" className="w-40">
                {(id) => <Input id={id} type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />}
              </Field>
            </>
          )}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <CategorySelect
            aria-label="Categoria"
            value={categoryId}
            onChange={setCategoryId}
            emptyLabel="Todas as categorias"
          />
          <Select aria-label="Conta" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Todas as contas</option>
            {data.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <Select aria-label="Cartão" value={cardId} onChange={(e) => setCardId(e.target.value)}>
            <option value="">Todos os cartões</option>
            {data.cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <section aria-label="Totais do período" className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Receita total" value={formatBRL(report.income)} icon={ArrowUpRight} tone="pos" />
        <StatCard label="Despesa total" value={formatBRL(report.expense)} icon={ArrowDownRight} tone="neg" />
        <StatCard
          label="Economia"
          value={formatBRL(report.savings)}
          icon={PiggyBank}
          tone="brand"
          hint={report.income > 0 ? `${formatPercent(report.rate)} economizado` : undefined}
        />
        <StatCard
          label="Categoria com maior gasto"
          value={top ? top.name : '—'}
          icon={Crown}
          hint={top ? `${formatBRL(top.total)} · ${formatPercent(ratio(top.total, report.expense))} das despesas` : undefined}
        />
        <StatCard
          label="Gastos fixos"
          value={formatBRL(report.fixed)}
          icon={Repeat}
          hint={`${formatPercent(ratio(report.fixed, report.expense))} das despesas`}
        />
        <StatCard
          label="Gastos variáveis"
          value={formatBRL(report.variable)}
          icon={ShoppingBag}
          hint={`${formatPercent(ratio(report.variable, report.expense))} das despesas`}
        />
      </section>

      {empty ? (
        <Card>
          <EmptyState
            icon={ChartColumn}
            title="Sem movimentações neste recorte"
            description="Ajuste o período ou os filtros para ver os relatórios."
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Receitas x despesas"
              subtitle={report.contextual ? 'Últimos 6 meses até o mês selecionado' : 'Por mês, no período'}
            />
            <FinancialChart data={report.monthly} series={INCOME_EXPENSE} caption="Receitas e despesas por mês" />
          </Card>

          <Card>
            <CardHeader title="Gastos por categoria" subtitle="Participação nas despesas do período" />
            {report.categories.length === 0 ? (
              <EmptyState compact icon={ChartColumn} title="Nenhuma despesa no período" />
            ) : (
              <ul className="space-y-3.5">
                {report.categories.slice(0, 8).map((c) => (
                  <li key={c.name}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="truncate font-semibold text-ink-2">{c.name}</span>
                      <span className="tnum shrink-0 text-muted">
                        <span className="font-bold text-ink">{formatBRL(c.total)}</span> ·{' '}
                        {formatPercent(ratio(c.total, report.expense))}
                      </span>
                    </div>
                    <ProgressBar
                      value={ratio(c.total, report.categories[0].total)}
                      color={c.color}
                      label={`${c.name}: ${formatBRL(c.total)}`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Economia mensal" subtitle="Receitas menos despesas de cada mês" />
            <FinancialChart data={report.monthly} series={SAVINGS} caption="Economia por mês" />
          </Card>

          <Card>
            <CardHeader
              title="Evolução do patrimônio"
              subtitle={filtersActive ? 'Considera todas as contas (não segue os filtros)' : 'Últimos 12 meses'}
            />
            <FinancialChart data={worth} series={WORTH} caption="Patrimônio no fim de cada mês" />
          </Card>

          <Card>
            <CardHeader title="Planejado x realizado" subtitle={monthLabel(report.planMonth)} />
            {report.plan.length === 0 ? (
              <EmptyState
                compact
                icon={ChartColumn}
                title="Sem planejamento neste mês"
                description="Crie um em Orçamento › Planejamento do mês."
              />
            ) : (
              <FinancialChart
                horizontal
                height={Math.max(220, report.plan.length * 52)}
                data={report.plan}
                series={PLAN}
                caption="Planejado e realizado por categoria"
              />
            )}
          </Card>

          <Card>
            <CardHeader title="Saúde financeira" subtitle="Indicadores objetivos, sem nota única" />
            <HealthPanel indicators={health} />
          </Card>
        </div>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Comparação entre meses                                              */
/* ------------------------------------------------------------------ */

function Compare() {
  const data = useFinance()
  const today = todayISO()
  const [a, setA] = useState<MonthKey>(() => addMonths(currentMonth(), -2))
  const [b, setB] = useState<MonthKey>(() => addMonths(currentMonth(), -1))

  const view = useMemo(() => {
    const sa = summarize(data, a, today)
    const sb = summarize(data, b, today)
    const ca = new Map(expensesByCategory(data, a, today).map((c) => [c.id, c]))
    const cb = new Map(expensesByCategory(data, b, today).map((c) => [c.id, c]))
    const ids = new Set([...ca.keys(), ...cb.keys()])
    const categories = [...ids]
      .map((id) => ({
        id,
        name: (ca.get(id) ?? cb.get(id))!.category?.name ?? 'Sem categoria',
        a: ca.get(id)?.total ?? 0,
        b: cb.get(id)?.total ?? 0,
      }))
      .sort((x, y) => Math.max(y.a, y.b) - Math.max(x.a, x.b))
    return { sa, sb, categories }
  }, [data, a, b, today])

  const { sa, sb } = view
  const empty = sa.income + sa.expense + sb.income + sb.expense === 0

  return (
    <>
      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3">
          <MonthSelector value={a} onChange={setA} />
          <span className="text-sm font-bold text-muted">vs.</span>
          <MonthSelector value={b} onChange={setB} />
        </div>
      </Card>

      {empty ? (
        <Card>
          <EmptyState icon={ChartColumn} title="Sem movimentações nos meses escolhidos" />
        </Card>
      ) : (
        <Card padded={false} className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-bold tracking-wide text-muted uppercase">
                <th scope="col" className="px-5 py-3 sm:px-6">Indicador</th>
                <th scope="col" className="px-3 py-3 text-right">{monthLabelSlash(a)}</th>
                <th scope="col" className="px-3 py-3 text-right">{monthLabelSlash(b)}</th>
                <th scope="col" className="px-5 py-3 text-right sm:px-6">Variação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <CompareRow label="Receita" a={sa.income} b={sb.income} upIsGood strong />
              <CompareRow label="Despesas" a={sa.expense} b={sb.expense} strong />
              <CompareRow label="Economia" a={sa.balance} b={sb.balance} upIsGood strong />
              <tr>
                <th scope="row" className="px-5 py-3 text-left font-bold text-ink sm:px-6">
                  Percentual economizado
                </th>
                <td className="tnum px-3 py-3 text-right font-semibold text-ink">
                  {sa.income > 0 ? formatPercent(sa.savingsRate) : '—'}
                </td>
                <td className="tnum px-3 py-3 text-right font-semibold text-ink">
                  {sb.income > 0 ? formatPercent(sb.savingsRate) : '—'}
                </td>
                <td className="px-5 py-3 text-right sm:px-6">
                  {sa.income > 0 && sb.income > 0 ? (
                    <Delta
                      change={sb.savingsRate - sa.savingsRate}
                      text={`${formatPercent(Math.abs(sb.savingsRate - sa.savingsRate) , 1).replace('%', '')} p.p.`}
                      upIsGood
                    />
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              </tr>
              {view.categories.length > 0 && (
                <tr className="bg-surface-2/50">
                  <th
                    scope="colgroup"
                    colSpan={4}
                    className="px-5 py-2 text-left text-xs font-bold tracking-wide text-muted uppercase sm:px-6"
                  >
                    Despesas por categoria
                  </th>
                </tr>
              )}
              {view.categories.map((c) => (
                <CompareRow key={c.id} label={c.name} a={c.a} b={c.b} />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  )
}

interface CompareRowProps {
  label: string
  a: number
  b: number
  /** Receita e economia: subir é bom. Despesas: subir é ruim. */
  upIsGood?: boolean
  strong?: boolean
}

function CompareRow({ label, a, b, upIsGood = false, strong = false }: CompareRowProps) {
  const change = a !== 0 ? (b - a) / Math.abs(a) : null
  return (
    <tr>
      <th scope="row" className={cn('px-5 py-3 text-left sm:px-6', strong ? 'font-bold text-ink' : 'font-medium text-ink-2')}>
        {label}
      </th>
      <td className="tnum px-3 py-3 text-right font-semibold text-ink">{formatBRL(a)}</td>
      <td className="tnum px-3 py-3 text-right font-semibold text-ink">{formatBRL(b)}</td>
      <td className="px-5 py-3 text-right sm:px-6">
        {change === null ? (
          <span className="text-xs text-muted">{b !== 0 ? 'novo' : '—'}</span>
        ) : (
          <Delta change={change} text={formatPercent(Math.abs(change))} upIsGood={upIsGood} />
        )}
      </td>
    </tr>
  )
}

function Delta({ change, text, upIsGood }: { change: number; text: string; upIsGood: boolean }) {
  if (Math.abs(change) < 0.005) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-muted">
        <Minus className="size-3.5" aria-label="sem variação" />
        0%
      </span>
    )
  }
  const up = change > 0
  const good = up === upIsGood
  const Icon = up ? ArrowUp : ArrowDown
  return (
    <span className={cn('tnum inline-flex items-center gap-1 text-xs font-bold', good ? 'text-pos' : 'text-neg')}>
      <Icon className="size-3.5" aria-label={up ? 'aumento de' : 'queda de'} />
      {text}
    </span>
  )
}
