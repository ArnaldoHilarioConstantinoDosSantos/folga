import { useMemo, useState } from 'react'
import { CalendarCheck, Hourglass, Percent, Plus, Repeat } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { MonthSelector } from '@/components/MonthSelector'
import { PageHeader } from '@/components/PageHeader'
import { RecurringList } from '@/components/RecurringList'
import { RecurringModal } from '@/components/RecurringModal'
import { StatCard } from '@/components/StatCard'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/Feedback'
import { useFinance } from '@/contexts/FinanceContext'
import { useMonth } from '@/contexts/MonthContext'
import { todayISO } from '@/utils/date'
import { fixedMonthlyTotal, referenceIncome, transactionsOfMonth } from '@/utils/finance'
import { formatBRL, formatPercent, ratio, sumBy } from '@/utils/money'

export default function FixedExpenses() {
  const data = useFinance()
  const { month } = useMonth()
  const [adding, setAdding] = useState(false)
  const today = todayISO()

  const items = useMemo(
    () =>
      data.recurring
        .filter((r) => r.type === 'expense')
        .sort((a, b) => Number(b.active) - Number(a.active) || a.day - b.day),
    [data.recurring],
  )

  const stats = useMemo(() => {
    const occurrences = transactionsOfMonth(data, month, today).filter(
      (t) => t.type === 'expense' && t.recurring_id,
    )
    const total = fixedMonthlyTotal(data)
    const income = referenceIncome(data, month, today)
    return {
      total,
      income,
      share: ratio(total, income),
      monthTotal: sumBy(occurrences, (t) => t.amount_cents),
      paid: sumBy(occurrences.filter((t) => t.paid), (t) => t.amount_cents),
      pending: sumBy(occurrences.filter((t) => !t.paid), (t) => t.amount_cents),
    }
  }, [data, month, today])

  return (
    <>
      <PageHeader
        title="Gastos Fixos"
        subtitle="Contas que se repetem. Elas entram sozinhas como despesas previstas a cada mês."
        actions={
          <>
            <MonthSelector />
            <Button icon={Plus} onClick={() => setAdding(true)}>
              Novo gasto fixo
            </Button>
          </>
        }
      />

      <section aria-label="Resumo dos gastos fixos" className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total de gastos fixos"
          value={formatBRL(stats.total)}
          icon={Repeat}
          tone="brand"
          hint="Equivalente mensal"
        />
        <StatCard
          label="Comprometido da renda"
          value={stats.income > 0 ? formatPercent(stats.share) : '—'}
          icon={Percent}
          tone={stats.share > 0.5 ? 'warn' : 'neutral'}
          hint={stats.income > 0 ? `de ${formatBRL(stats.income)} de renda` : 'Cadastre sua renda em Receitas'}
        />
        <StatCard label="Pago no mês" value={formatBRL(stats.paid)} icon={CalendarCheck} tone="pos" />
        <StatCard label="Pendente no mês" value={formatBRL(stats.pending)} icon={Hourglass} tone="warn" />
      </section>

      {stats.income > 0 && stats.total > 0 && (
        <Card className="mb-6">
          <p className="mb-3 text-sm font-semibold text-ink">
            {formatPercent(stats.share)} da sua renda já está comprometida com gastos fixos.
          </p>
          <ProgressBar
            value={stats.share}
            tone={stats.share > 0.65 ? 'neg' : stats.share > 0.5 ? 'warn' : 'brand'}
            label={`Gastos fixos: ${formatPercent(stats.share)} da renda`}
          />
          <p className="mt-2 text-xs text-muted">
            Referência: manter os gastos fixos em até 50% da renda deixa espaço para imprevistos e metas.
          </p>
        </Card>
      )}

      <Card padded={false}>
        {items.length === 0 ? (
          <EmptyState
            icon={Repeat}
            title="Nenhum gasto fixo cadastrado"
            description="Cadastre aluguel, condomínio, internet, assinaturas e outras contas que se repetem."
            action={
              <Button icon={Plus} onClick={() => setAdding(true)}>
                Novo gasto fixo
              </Button>
            }
          />
        ) : (
          <RecurringList type="expense" month={month} items={items} />
        )}
      </Card>

      {adding && <RecurringModal open type="expense" onClose={() => setAdding(false)} />}
    </>
  )
}
