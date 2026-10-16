import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck,
  CalendarClock,
  ChevronRight,
  PiggyBank,
  Plus,
  Receipt,
  Sparkles,
  Wallet,
} from 'lucide-react'
import { BudgetProgress } from '@/components/BudgetProgress'
import { DonutChart } from '@/components/charts/DonutChart'
import { FinancialChart, type ChartSeries } from '@/components/charts/FinancialChart'
import { EmptyState } from '@/components/EmptyState'
import { HealthPanel } from '@/components/HealthPanel'
import { InsightList } from '@/components/InsightList'
import { MonthSelector } from '@/components/MonthSelector'
import { StatCard } from '@/components/StatCard'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge, Segmented } from '@/components/ui/Feedback'
import { useFinance } from '@/contexts/FinanceContext'
import { useMonth } from '@/contexts/MonthContext'
import { useTransactionModal } from '@/contexts/TransactionModalContext'
import { cn } from '@/lib/cn'
import { formatDayMonth, monthName, relativeDay, todayISO } from '@/utils/date'
import {
  budgetStatuses,
  calendarItems,
  healthIndicators,
  incomeDistribution,
  isRealized,
  monthlySeries,
  summarize,
  transactionsOfMonth,
  upcomingBills,
} from '@/utils/finance'
import { monthInsights, trendMessages } from '@/utils/insights'
import { formatBRL, formatPercent, sumBy } from '@/utils/money'
import { monthlyEquivalent } from '@/utils/recurring'

type Range = '3' | '6' | '12'

const RANGE_OPTIONS: Array<{ value: Range; label: string }> = [
  { value: '3', label: '3 meses' },
  { value: '6', label: '6 meses' },
  { value: '12', label: '12 meses' },
]

const EVOLUTION_SERIES: ChartSeries[] = [
  { key: 'income', label: 'Receitas', color: 'var(--series-income)' },
  { key: 'expense', label: 'Despesas', color: 'var(--series-expense)' },
  { key: 'savings', label: 'Economia', color: 'var(--series-savings)', kind: 'line' },
]

export default function Dashboard() {
  const data = useFinance()
  const { month, isCurrent } = useMonth()
  const modal = useTransactionModal()
  const [range, setRange] = useState<Range>('6')
  const today = todayISO()

  const view = useMemo(() => {
    const summary = summarize(data, month, today)
    const pending = transactionsOfMonth(data, month, today).filter(
      (t) => t.type === 'expense' && !isRealized(t, today),
    )
    return {
      summary,
      distribution: incomeDistribution(data, month, today),
      trend: trendMessages(data, month, today),
      insights: monthInsights(data, month, today),
      health: healthIndicators(data, month, today),
      budgets: budgetStatuses(data, month, today).slice(0, 4),
      bills: (isCurrent
        ? upcomingBills(data, today, 30)
        : calendarItems(data, month, today).filter((i) => i.kind !== 'income' && !i.done)
      ).slice(0, 6),
      forecast: {
        fixed: sumBy(pending.filter((t) => t.recurring_id), (t) => t.amount_cents),
        installments: sumBy(pending.filter((t) => t.installment_id), (t) => t.amount_cents),
        others: sumBy(pending.filter((t) => !t.recurring_id && !t.installment_id), (t) => t.amount_cents),
      },
    }
  }, [data, month, today, isCurrent])

  const series = useMemo(
    () => monthlySeries(data, month, Number(range), today).map((p) => ({ ...p })),
    [data, month, range, today],
  )

  const incomeSources = data.recurring.filter((r) => r.active && r.type === 'income')
  const { summary, distribution, forecast } = view
  const firstName = data.profile.full_name.trim().split(' ')[0]
  const hasAnyData = data.transactions.length > 0 || data.recurring.length > 0

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            {firstName ? `Olá, ${firstName}` : 'Olá'}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {isCurrent ? 'Sua situação financeira neste mês.' : `Resumo de ${monthName(month).toLowerCase()}.`}
          </p>
        </div>
        <MonthSelector />
      </header>

      {!hasAnyData && (
        <Card>
          <EmptyState
            icon={Sparkles}
            title="Comece registrando seu primeiro lançamento"
            description="Assim que houver receitas e despesas, o resumo, os gráficos e os insights aparecem aqui."
            action={
              <Button icon={Plus} onClick={() => modal.create()}>
                Novo lançamento
              </Button>
            }
          />
        </Card>
      )}

      {/* Cards principais */}
      <section aria-label="Resumo do mês" className="grid gap-4 lg:grid-cols-12">
        <StatCard
          hero
          className="lg:col-span-4"
          label="Saldo do mês"
          value={formatBRL(summary.balance)}
          icon={Wallet}
          hint={
            summary.pendingExpense > 0 || summary.pendingIncome > 0
              ? `Projeção para o fim do mês: ${formatBRL(summary.projected)}`
              : 'Receitas menos despesas'
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-8">
          <StatCard
            label="Receitas"
            value={formatBRL(summary.income)}
            icon={ArrowUpRight}
            tone="pos"
            hint={
              summary.pendingIncome > 0 ? `+ ${formatBRL(summary.pendingIncome)} a receber` : 'Total recebido no mês'
            }
          />
          <StatCard
            label="Despesas"
            value={formatBRL(summary.expense)}
            icon={ArrowDownRight}
            tone="neg"
            hint="Total gasto no mês"
          />
          <StatCard
            label="Economia"
            value={summary.income > 0 ? formatPercent(summary.savingsRate) : '—'}
            icon={PiggyBank}
            tone="brand"
            hint={
              summary.income === 0
                ? 'Nenhuma receita recebida ainda'
                : summary.balance >= 0
                  ? `Economia de ${formatPercent(summary.savingsRate)} da sua renda${
                      isCurrent && summary.pendingExpense > 0 ? ' até agora' : ''
                    } (${formatBRL(summary.balance)})`
                  : `Você gastou ${formatBRL(-summary.balance)} além da renda`
            }
          />
          <StatCard
            label="Gastos previstos"
            value={formatBRL(summary.pendingExpense)}
            icon={CalendarClock}
            tone="warn"
            hint="Despesas que ainda vencem neste mês"
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Evolução */}
        <Card className="lg:col-span-8">
          <CardHeader
            title="Evolução financeira"
            subtitle="Receitas, despesas e economia mês a mês"
            action={<Segmented label="Período" size="sm" value={range} onChange={setRange} options={RANGE_OPTIONS} />}
          />
          <FinancialChart
            data={series}
            series={EVOLUTION_SERIES}
            caption={`Receitas, despesas e economia dos últimos ${range} meses`}
          />
          {view.trend.length > 0 && (
            <InsightList items={view.trend} className="mt-5 grid gap-x-6 border-t border-line pt-5 sm:grid-cols-2 sm:space-y-0" />
          )}
        </Card>

        {/* Distribuição da renda */}
        <Card className="lg:col-span-4">
          <CardHeader title="Para onde foi sua renda" subtitle="Distribuição das receitas do mês" />
          {distribution.slices.length === 0 ? (
            <EmptyState compact icon={Receipt} title="Sem movimentações neste mês" />
          ) : (
            <DonutChart
              slices={distribution.slices}
              centerLabel={summary.income > 0 ? 'Renda' : 'Gastos'}
              centerValue={formatBRL(distribution.base, { compact: distribution.base >= 10_000_000 })}
              caption="Distribuição da renda do mês por categoria"
            />
          )}
          {incomeSources.length > 0 && (
            <dl className="mt-6 space-y-1.5 border-t border-line pt-4 text-[13px]">
              {incomeSources.map((r) => (
                <div key={r.id} className="flex justify-between gap-3">
                  <dt className="truncate text-ink-2">{r.description}</dt>
                  <dd className="tnum font-semibold text-ink">{formatBRL(monthlyEquivalent(r))}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 border-t border-line pt-1.5">
                <dt className="font-bold text-ink">Renda mensal</dt>
                <dd className="tnum font-extrabold text-ink">{formatBRL(sumBy(incomeSources, monthlyEquivalent))}</dd>
              </div>
            </dl>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Previsão do fim do mês */}
        <Card>
          <CardHeader title="Previsão do fim do mês" subtitle="Com o que já está previsto" />
          <dl className="space-y-3 text-sm">
            <ForecastRow label="Saldo atual" value={formatBRL(summary.balance)} strong />
            {summary.pendingIncome > 0 && (
              <ForecastRow label="Receitas previstas" value={formatBRL(summary.pendingIncome, { sign: true })} />
            )}
            <ForecastRow label="Gastos fixos pendentes" value={formatBRL(-forecast.fixed)} muted={forecast.fixed === 0} />
            <ForecastRow label="Parcelas" value={formatBRL(-forecast.installments)} muted={forecast.installments === 0} />
            <ForecastRow label="Outras contas previstas" value={formatBRL(-forecast.others)} muted={forecast.others === 0} />
            <div className="border-t border-line pt-3">
              <ForecastRow label="Ainda previsto de despesas" value={formatBRL(summary.pendingExpense)} />
            </div>
          </dl>
          <div
            className={cn(
              'mt-4 rounded-xl px-4 py-3',
              summary.projected < 0 ? 'bg-neg-soft text-neg' : 'bg-brand-soft text-brand',
            )}
          >
            <p className="text-xs font-semibold">Saldo projetado no fim do mês</p>
            <p className="text-2xl font-extrabold tracking-tight">{formatBRL(summary.projected)}</p>
          </div>
        </Card>

        {/* Insights */}
        <Card>
          <CardHeader title="Insights do mês" subtitle="Calculados a partir dos seus lançamentos" />
          {view.insights.length === 0 ? (
            <EmptyState compact icon={Sparkles} title="Ainda sem insights" description="Eles surgem conforme você registra seus gastos." />
          ) : (
            <InsightList items={view.insights} />
          )}
        </Card>

        {/* Saúde financeira */}
        <Card>
          <CardHeader
            title="Saúde financeira"
            subtitle="Indicadores objetivos"
            action={
              <Link to="/relatorios" className="text-[13px] font-semibold text-brand hover:underline">
                Relatórios
              </Link>
            }
          />
          <HealthPanel indicators={view.health} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Próximos vencimentos */}
        <Card padded={false}>
          <CardHeader
            className="mb-0 p-5 pb-3 sm:p-6 sm:pb-3"
            title={isCurrent ? 'Próximos vencimentos' : 'Contas em aberto no mês'}
            action={
              <Link to="/calendario" className="flex items-center text-[13px] font-semibold text-brand hover:underline">
                Calendário <ChevronRight className="size-3.5" aria-hidden />
              </Link>
            }
          />
          {view.bills.length === 0 ? (
            <EmptyState compact icon={CalendarCheck} title="Nada em aberto" description="Nenhuma conta a vencer por aqui." />
          ) : (
            <ul className="divide-y divide-line pb-2">
              {view.bills.map((bill) => {
                const late = bill.date < today
                return (
                  <li key={bill.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                    <span className="tnum flex size-10 shrink-0 flex-col items-center justify-center rounded-xl bg-surface-2 text-xs leading-tight font-bold text-ink-2">
                      {formatDayMonth(bill.date)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{bill.label}</p>
                      <p className="text-xs text-muted">Vence {relativeDay(bill.date, today)}</p>
                    </div>
                    {late && <Badge tone="neg">Atrasada</Badge>}
                    <span className="tnum text-sm font-bold text-ink">{formatBRL(bill.amount)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {/* Orçamento */}
        <Card>
          <CardHeader
            title="Orçamento do mês"
            action={
              <Link to="/orcamento" className="flex items-center text-[13px] font-semibold text-brand hover:underline">
                Ver tudo <ChevronRight className="size-3.5" aria-hidden />
              </Link>
            }
          />
          {view.budgets.length === 0 ? (
            <EmptyState
              compact
              icon={Wallet}
              title="Nenhum limite definido"
              description="Crie limites por categoria para acompanhar seus gastos."
            />
          ) : (
            <div className="space-y-5">
              {view.budgets.map((b) => (
                <BudgetProgress
                  key={b.budget.id}
                  label={b.category?.name ?? 'Categoria removida'}
                  icon={b.category?.icon}
                  color={b.category?.color}
                  spent={b.spent}
                  limit={b.budget.limit_cents}
                />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function ForecastRow({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={cn(strong ? 'font-bold text-ink' : 'text-ink-2', muted && 'text-muted')}>{label}</dt>
      <dd className={cn('tnum', strong ? 'font-extrabold text-ink' : 'font-semibold text-ink', muted && 'text-muted')}>
        {value}
      </dd>
    </div>
  )
}
