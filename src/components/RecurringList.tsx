import { useState } from 'react'
import { Check, Pencil, Trash2 } from 'lucide-react'
import { useFinance } from '@/contexts/FinanceContext'
import { useDb } from '@/hooks/useDb'
import { cn } from '@/lib/cn'
import { removeRecurring } from '@/services/operations'
import type { MonthKey, Recurring, Transaction, TxType } from '@/types'
import { WEEKDAYS, formatDayMonth, pad, todayISO } from '@/utils/date'
import { categoryIndex, transactionsOfMonth } from '@/utils/finance'
import { FREQUENCIES } from '@/utils/labels'
import { formatBRL } from '@/utils/money'
import { CategoryIcon } from './CategoryIcon'
import { ConfirmDialog } from './ConfirmDialog'
import { RecurringModal } from './RecurringModal'
import { IconButton } from './ui/Button'
import { Badge } from './ui/Feedback'

export function scheduleText(rec: Recurring): string {
  if (rec.frequency === 'weekly') {
    const weekday = rec.weekday ?? 1
    const article = weekday === 0 || weekday === 6 ? 'Todo' : 'Toda'
    return `${article} ${WEEKDAYS[weekday].toLowerCase()}`
  }
  if (rec.frequency === 'yearly') return `Todo ano em ${pad(rec.day)}/${pad(rec.month ?? 1)}`
  return `Todo dia ${rec.day}`
}

interface RecurringListProps {
  type: TxType
  /** Mês cujas ocorrências aparecem com o estado pago/pendente. */
  month: MonthKey
  items: Recurring[]
}

/** Lista de recorrentes com a situação de cada um no mês selecionado. */
export function RecurringList({ type, month, items }: RecurringListProps) {
  const data = useFinance()
  const db = useDb()
  const [editing, setEditing] = useState<Recurring | null>(null)
  const [deleting, setDeleting] = useState<Recurring | null>(null)
  const index = categoryIndex(data.categories)
  const today = todayISO()

  const occurrences = new Map<string, Transaction[]>()
  for (const t of transactionsOfMonth(data, month, today)) {
    if (!t.recurring_id) continue
    const list = occurrences.get(t.recurring_id) ?? []
    list.push(t)
    occurrences.set(t.recurring_id, list)
  }

  const paidLabel = type === 'expense' ? 'Pago' : 'Recebido'

  return (
    <>
      <ul className="divide-y divide-line">
        {items.map((rec) => {
          const category = index.byId.get(rec.category_id ?? '')
          const root = index.rootOf(rec.category_id)
          const list = (occurrences.get(rec.id) ?? []).sort((a, b) => a.date.localeCompare(b.date))
          return (
            <li key={rec.id} className={cn('group px-4 py-3.5 sm:px-5', !rec.active && 'opacity-60')}>
              <div className="flex items-center gap-3">
                <CategoryIcon icon={category?.icon ?? root?.icon} color={root?.color} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <span className="truncate">{rec.description}</span>
                    {!rec.active && <Badge>Inativo</Badge>}
                    {rec.frequency !== 'monthly' && <Badge>{FREQUENCIES[rec.frequency]}</Badge>}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {scheduleText(rec)} · {index.pathOf(rec.category_id)}
                  </p>
                </div>
                <div className="hidden md:flex md:opacity-0 md:transition-opacity md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                  <IconButton icon={Pencil} label={`Editar ${rec.description}`} onClick={() => setEditing(rec)} />
                  <IconButton
                    icon={Trash2}
                    label={`Excluir ${rec.description}`}
                    tone="danger"
                    onClick={() => setDeleting(rec)}
                  />
                </div>
                <span className="tnum shrink-0 text-sm font-bold text-ink">{formatBRL(rec.amount_cents)}</span>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pl-[52px]">
                {list.length === 0 && <span className="text-xs text-muted">Sem ocorrência neste mês</span>}
                {list.map((t) => {
                  const date = formatDayMonth(t.date)
                  if (t.virtual) {
                    return (
                      <Badge key={t.id}>
                        {date} · Previsto
                      </Badge>
                    )
                  }
                  if (t.card_id) {
                    return (
                      <Badge key={t.id} tone={t.paid ? 'pos' : 'neutral'}>
                        {date} · {t.paid ? 'Fatura paga' : 'Na fatura'}
                      </Badge>
                    )
                  }
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={t.paid}
                      onClick={() =>
                        db.update(
                          'transactions',
                          t.id,
                          { paid: !t.paid },
                          t.paid ? 'Marcado como pendente' : `Marcado como ${paidLabel.toLowerCase()}`,
                        )
                      }
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold transition-colors',
                        t.paid
                          ? 'bg-pos-soft text-pos'
                          : t.date < today
                            ? 'bg-neg-soft text-neg hover:opacity-80'
                            : 'bg-warn-soft text-warn hover:opacity-80',
                      )}
                    >
                      {t.paid && <Check className="size-3" strokeWidth={3} aria-hidden />}
                      {date} · {t.paid ? paidLabel : t.date < today ? 'Atrasado' : 'Pendente'}
                    </button>
                  )
                })}
                <div className="ml-auto flex md:hidden">
                  <IconButton icon={Pencil} label={`Editar ${rec.description}`} onClick={() => setEditing(rec)} />
                  <IconButton
                    icon={Trash2}
                    label={`Excluir ${rec.description}`}
                    tone="danger"
                    onClick={() => setDeleting(rec)}
                  />
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {editing && <RecurringModal open type={type} editing={editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={type === 'expense' ? 'Excluir gasto fixo?' : 'Excluir renda?'}
        description={`"${deleting?.description ?? ''}" deixará de ser gerado e os lançamentos pendentes serão removidos. O histórico já pago é mantido.`}
        onConfirm={async () => {
          if (deleting) await db.run(() => removeRecurring(deleting, data.transactions), 'Excluído')
        }}
      />
    </>
  )
}
