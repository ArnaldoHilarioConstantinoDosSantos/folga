import { useMemo } from 'react'
import { Layers, Repeat, ShoppingBag } from 'lucide-react'
import { StatCard } from '@/components/StatCard'
import { TransactionsView } from '@/components/TransactionsView'
import { useFinance } from '@/contexts/FinanceContext'
import { useMonth } from '@/contexts/MonthContext'
import { monthName, todayISO } from '@/utils/date'
import { isRealized } from '@/utils/finance'
import { formatBRL, formatPercent, ratio, sumBy } from '@/utils/money'

export default function Expenses() {
  const { transactions } = useFinance()
  const { month } = useMonth()
  const today = todayISO()

  const split = useMemo(() => {
    const spent = transactions.filter(
      (t) => t.type === 'expense' && t.date.startsWith(month) && isRealized(t, today),
    )
    const amount = (list: typeof spent) => sumBy(list, (t) => t.amount_cents)
    const fixed = amount(spent.filter((t) => t.recurring_id))
    const installments = amount(spent.filter((t) => t.installment_id))
    const total = amount(spent)
    return { fixed, installments, variable: total - fixed - installments, total }
  }, [transactions, month, today])

  const share = (value: number) => `${formatPercent(ratio(value, split.total))} das despesas`

  return (
    <TransactionsView title="Despesas" subtitle="Tudo o que sai: gastos fixos, variáveis e parcelas.">
      <section
        aria-label={`Composição das despesas de ${monthName(month).toLowerCase()}`}
        className="mb-6 grid gap-4 sm:grid-cols-3"
      >
        <StatCard label="Gastos fixos" value={formatBRL(split.fixed)} icon={Repeat} hint={share(split.fixed)} />
        <StatCard
          label="Gastos variáveis"
          value={formatBRL(split.variable)}
          icon={ShoppingBag}
          hint={share(split.variable)}
        />
        <StatCard label="Parcelas" value={formatBRL(split.installments)} icon={Layers} hint={share(split.installments)} />
      </section>
    </TransactionsView>
  )
}
