import { useMemo, useState, type ReactNode } from 'react'
import { Check, Copy, CreditCard, Pencil, Repeat, Trash2 } from 'lucide-react'
import { useFinance } from '@/contexts/FinanceContext'
import { useTransactionModal } from '@/contexts/TransactionModalContext'
import { useDb } from '@/hooks/useDb'
import { cn } from '@/lib/cn'
import type { Transaction } from '@/types'
import { WEEKDAYS, formatDate, parseISO, todayISO } from '@/utils/date'
import { categoryIndex } from '@/utils/finance'
import { PAYMENT_METHODS } from '@/utils/labels'
import { formatBRL } from '@/utils/money'
import { CategoryIcon } from './CategoryIcon'
import { ConfirmDialog } from './ConfirmDialog'
import { Button, IconButton } from './ui/Button'
import { Badge } from './ui/Feedback'

interface TransactionTableProps {
  transactions: readonly Transaction[]
  /** Agrupa por dia com cabeçalho de data (padrão) ou mostra a data em cada linha. */
  grouped?: boolean
  /** Conteúdo quando a lista está vazia. */
  empty?: ReactNode
  pageSize?: number
}

/** Lista de lançamentos com as ações de pagar, editar, duplicar e excluir. */
export function TransactionTable({ transactions, grouped = true, empty, pageSize = 60 }: TransactionTableProps) {
  const { categories, accounts, cards } = useFinance()
  const modal = useTransactionModal()
  const db = useDb()
  const [visible, setVisible] = useState(pageSize)
  const [deleting, setDeleting] = useState<Transaction | null>(null)
  const today = todayISO()

  const index = categoryIndex(categories)
  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])
  const cardName = useMemo(() => new Map(cards.map((c) => [c.id, c.name])), [cards])

  const sorted = useMemo(
    () => [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)),
    [transactions],
  )
  const page = sorted.slice(0, visible)

  if (sorted.length === 0) return <>{empty}</>

  const togglePaid = (t: Transaction) =>
    db.update('transactions', t.id, { paid: !t.paid }, t.paid ? 'Marcado como pendente' : 'Marcado como pago')

  const row = (t: Transaction) => {
    const category = index.byId.get(t.category_id ?? '')
    const root = index.rootOf(t.category_id)
    const source = t.card_id ? cardName.get(t.card_id) : t.account_id ? accountName.get(t.account_id) : null
    const meta = [
      grouped ? null : formatDate(t.date),
      index.pathOf(t.category_id),
      source,
      PAYMENT_METHODS[t.payment_method],
    ].filter(Boolean)
    const late = !t.paid && !t.card_id && t.date < today

    return (
      <li
        key={t.id}
        className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/60 sm:px-5"
      >
        <CategoryIcon icon={category?.icon ?? root?.icon} color={root?.color} />
        <button
          type="button"
          onClick={() => modal.edit(t)}
          className="min-w-0 flex-1 text-left"
          aria-label={`Editar ${t.description}`}
        >
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-ink">{t.description}</span>
            {t.installment_number && t.installment_total && (
              <Badge>
                {t.installment_number}/{t.installment_total}
              </Badge>
            )}
            {t.recurring_id && <Repeat className="size-3.5 shrink-0 text-muted" aria-label="Recorrente" />}
            {late && <Badge tone="neg">Atrasado</Badge>}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted">{meta.join(' · ')}</span>
        </button>

        <div className="hidden items-center opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 md:flex">
          <IconButton icon={Pencil} label="Editar" onClick={() => modal.edit(t)} />
          <IconButton icon={Copy} label="Duplicar" onClick={() => modal.duplicate(t)} />
          <IconButton icon={Trash2} label="Excluir" tone="danger" onClick={() => setDeleting(t)} />
        </div>

        <span
          className={cn(
            'tnum w-24 shrink-0 text-right text-sm font-bold sm:w-28',
            t.type === 'income' ? 'text-pos' : 'text-ink',
          )}
        >
          {t.type === 'income' ? formatBRL(t.amount_cents, { sign: true }) : formatBRL(-t.amount_cents)}
        </span>

        {t.card_id ? (
          <span
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-full',
              t.paid ? 'bg-pos-soft text-pos' : 'bg-surface-2 text-muted',
            )}
            title={t.paid ? 'Fatura paga' : 'Na fatura do cartão'}
            aria-label={t.paid ? 'Fatura paga' : 'Na fatura do cartão'}
          >
            <CreditCard className="size-3.5" aria-hidden />
          </span>
        ) : (
          <button
            type="button"
            onClick={() => togglePaid(t)}
            aria-pressed={t.paid}
            aria-label={t.paid ? 'Pago — marcar como pendente' : 'Pendente — marcar como pago'}
            title={t.paid ? 'Pago' : 'Pendente'}
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors',
              t.paid
                ? 'border-transparent bg-pos-soft text-pos'
                : 'border-line text-transparent hover:border-pos hover:text-pos',
            )}
          >
            <Check className="size-3.5" strokeWidth={3} aria-hidden />
          </button>
        )}
      </li>
    )
  }

  // Agrupa a página por dia, preservando a ordem já decrescente.
  const groups: Array<{ date: string; items: Transaction[] }> = []
  for (const t of page) {
    const last = groups.at(-1)
    if (last && last.date === t.date) last.items.push(t)
    else groups.push({ date: t.date, items: [t] })
  }

  return (
    <>
      {grouped ? (
        <div>
          {groups.map((group) => (
            <section key={group.date}>
              <h3 className="flex items-center gap-2 border-y border-line bg-surface-2/50 px-4 py-1.5 text-xs font-semibold text-muted first:border-t-0 sm:px-5">
                <span className="tnum text-ink-2">{formatDate(group.date)}</span>
                <span>{WEEKDAYS[parseISO(group.date).getDay()]}</span>
              </h3>
              <ul className="divide-y divide-line">{group.items.map(row)}</ul>
            </section>
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-line">{page.map(row)}</ul>
      )}

      {sorted.length > visible && (
        <div className="border-t border-line p-3 text-center">
          <Button variant="ghost" size="sm" onClick={() => setVisible((v) => v + pageSize)}>
            Mostrar mais ({sorted.length - visible} restantes)
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Excluir lançamento?"
        description={`"${deleting?.description ?? ''}" será excluído. Esta ação não pode ser desfeita.`}
        onConfirm={async () => {
          if (deleting) await db.remove('transactions', deleting.id, 'Lançamento excluído')
        }}
      />
    </>
  )
}
