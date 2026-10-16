import { useState } from 'react'
import { Banknote, Plus } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { RecurringList } from '@/components/RecurringList'
import { RecurringModal } from '@/components/RecurringModal'
import { TransactionsView } from '@/components/TransactionsView'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { useFinance } from '@/contexts/FinanceContext'
import { useMonth } from '@/contexts/MonthContext'
import { formatBRL, sumBy } from '@/utils/money'
import { monthlyEquivalent } from '@/utils/recurring'

export default function Incomes() {
  const { recurring } = useFinance()
  const { month } = useMonth()
  const [adding, setAdding] = useState(false)
  const sources = recurring.filter((r) => r.type === 'income')
  const total = sumBy(sources.filter((r) => r.active), monthlyEquivalent)

  return (
    <TransactionsView title="Receitas" subtitle="Tudo o que entra: salário, renda extra e outros ganhos.">
      <Card padded={false} className="mb-6">
        <CardHeader
          className="mb-0 p-5 pb-4 sm:p-6 sm:pb-4"
          title="Renda mensal"
          subtitle={
            sources.length > 0 ? (
              <>
                Total cadastrado: <span className="tnum font-bold text-ink">{formatBRL(total)}</span> por mês
              </>
            ) : (
              'Cadastre o que você recebe todo mês.'
            )
          }
          action={
            <Button variant="secondary" size="sm" icon={Plus} onClick={() => setAdding(true)}>
              Nova renda
            </Button>
          }
        />
        {sources.length === 0 ? (
          <EmptyState
            compact
            icon={Banknote}
            title="Nenhuma renda cadastrada"
            description="Com a renda cadastrada, os percentuais e a previsão do mês ficam mais precisos."
          />
        ) : (
          <div className="border-t border-line">
            <RecurringList type="income" month={month} items={sources} />
          </div>
        )}
      </Card>
      {adding && <RecurringModal open type="income" onClose={() => setAdding(false)} />}
    </TransactionsView>
  )
}
