import { useMemo, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { FinancialChart, type ChartSeries } from '@/components/charts/FinancialChart'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge, ProgressBar, Segmented } from '@/components/ui/Feedback'
import { useFinance } from '@/contexts/FinanceContext'
import { currentMonth, monthLabel, monthShort } from '@/utils/date'
import { futureCommitments } from '@/utils/finance'
import { formatBRL, formatPercent, sumBy } from '@/utils/money'

type Range = '6' | '12'

const SERIES: ChartSeries[] = [
  { key: 'fixed', label: 'Gastos fixos', color: 'var(--cat-blue)' },
  { key: 'installments', label: 'Parcelas', color: 'var(--cat-orange)' },
  { key: 'cards', label: 'Cartões', color: 'var(--cat-aqua)' },
  { key: 'others', label: 'Outras contas', color: 'var(--cat-yellow)' },
]

export default function Future() {
  const data = useFinance()
  const [range, setRange] = useState<Range>('6')
  const current = currentMonth()

  const rows = useMemo(() => futureCommitments(data, current, Number(range)), [data, current, range])
  const total = sumBy(rows, (r) => r.total)
  const chart = rows.map((r) => ({
    label: monthShort(r.month),
    fixed: r.fixed,
    installments: r.installments,
    cards: r.cards,
    others: r.others,
  }))

  return (
    <>
      <PageHeader
        title="Despesas futuras"
        subtitle="O que já está comprometido nos próximos meses: faturas, parcelas e gastos fixos."
        actions={
          <Segmented
            label="Horizonte"
            value={range}
            onChange={setRange}
            options={[
              { value: '6', label: '6 meses' },
              { value: '12', label: '12 meses' },
            ]}
          />
        }
      />

      {total === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarClock}
            title="Nenhum compromisso futuro"
            description="Gastos fixos, parcelas e compras no cartão aparecem aqui assim que forem cadastrados."
          />
        </Card>
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader
              title="Renda futura já comprometida"
              subtitle={`${formatBRL(total)} em despesas conhecidas nos próximos ${range} meses`}
            />
            <FinancialChart data={chart} series={SERIES} stacked caption="Despesas comprometidas por mês, por tipo" />
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => (
              <Card key={row.month}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-[15px] font-bold text-ink">{monthLabel(row.month)}</h2>
                  {row.month === current && <Badge tone="brand">Este mês</Badge>}
                </div>
                <dl className="space-y-2 text-sm">
                  <Line label="Cartões" value={row.cards} color="var(--cat-aqua)" />
                  <Line label="Parcelas" value={row.installments} color="var(--cat-orange)" />
                  <Line label="Gastos fixos" value={row.fixed} color="var(--cat-blue)" />
                  {row.others > 0 && <Line label="Outras contas" value={row.others} color="var(--cat-yellow)" />}
                  <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2.5">
                    <dt className="font-bold text-ink">Total comprometido</dt>
                    <dd className="tnum text-base font-extrabold text-ink">{formatBRL(row.total)}</dd>
                  </div>
                </dl>
                {row.expectedIncome > 0 && (
                  <div className="mt-4">
                    <ProgressBar
                      value={row.share}
                      tone={row.share > 0.8 ? 'neg' : row.share > 0.6 ? 'warn' : 'brand'}
                      size="sm"
                      label={`${formatPercent(row.share)} da renda comprometida em ${monthLabel(row.month)}`}
                    />
                    <p className="mt-1.5 text-xs text-muted">
                      {formatPercent(row.share)} da renda mensal de {formatBRL(row.expectedIncome)}
                    </p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  )
}

function Line({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="flex items-center gap-2 text-ink-2">
        <span className="size-2 rounded-full" style={{ background: color }} aria-hidden />
        {label}
      </dt>
      <dd className="tnum font-semibold text-ink">{formatBRL(value)}</dd>
    </div>
  )
}
