import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CircleCheck, CreditCard as CardIcon, Plus, Receipt, RotateCcw } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { TransactionTable } from '@/components/TransactionTable'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge, ProgressBar, type Tone } from '@/components/ui/Feedback'
import { Field, Select } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { useFinance } from '@/contexts/FinanceContext'
import { useTransactionModal } from '@/contexts/TransactionModalContext'
import { useDb } from '@/hooks/useDb'
import { cn } from '@/lib/cn'
import { payInvoice, reopenInvoice } from '@/services/operations'
import type { MonthKey } from '@/types'
import { formatDate, monthLabel, monthShort, todayISO } from '@/utils/date'
import { cardInvoices, cardUsage, invoiceDueDate, invoiceKeyOf, type Invoice, type InvoiceStatus } from '@/utils/finance'
import { formatBRL, formatPercent } from '@/utils/money'

const STATUS: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  paid: { label: 'Paga', tone: 'pos' },
  open: { label: 'Aberta', tone: 'brand' },
  closed: { label: 'Fechada', tone: 'warn' },
  overdue: { label: 'Atrasada', tone: 'neg' },
  future: { label: 'Futura', tone: 'neutral' },
}

export default function CardInvoice() {
  const { cardId } = useParams()
  const data = useFinance()
  const db = useDb()
  const modal = useTransactionModal()
  const today = todayISO()
  const card = data.cards.find((c) => c.id === cardId)

  const invoices = useMemo(() => (card ? cardInvoices(data, card, today) : []), [data, card, today])
  const currentKey = card ? invoiceKeyOf(today, card.closing_day) : ''
  const [selectedKey, setSelectedKey] = useState<MonthKey | null>(null)
  const [paying, setPaying] = useState(false)
  const [reopening, setReopening] = useState(false)

  if (!card) {
    return (
      <EmptyState
        icon={CardIcon}
        title="Cartão não encontrado"
        action={
          <Link to="/cartoes" className="text-sm font-bold text-brand hover:underline">
            Voltar para Cartões
          </Link>
        }
      />
    )
  }

  // Sem escolha explícita: a fatura mais antiga em aberto, senão a atual.
  const fallback =
    invoices.find((i) => i.status === 'overdue' || i.status === 'closed')?.key ??
    invoices.find((i) => i.key === currentKey)?.key ??
    invoices.at(-1)?.key ??
    currentKey
  const key = selectedKey ?? fallback
  const invoice: Invoice = invoices.find((i) => i.key === key) ?? {
    key,
    card,
    items: [],
    total: 0,
    closingDate: `${key}-01`,
    dueDate: invoiceDueDate(key, card),
    status: 'open',
  }
  const usage = cardUsage(data, card)
  const status = STATUS[invoice.status]
  const canPay = invoice.items.length > 0 && invoice.status !== 'paid' && invoice.status !== 'future'

  return (
    <>
      <Link to="/cartoes" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        Cartões
      </Link>
      <PageHeader
        title={`Fatura ${card.name}`}
        subtitle={`Fecha dia ${card.closing_day} · Vence dia ${card.due_day}`}
        actions={
          <Button icon={Plus} onClick={() => modal.create({ type: 'expense', payment_method: 'credit', card_id: card.id })}>
            Nova compra
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
                Fatura de {monthLabel(invoice.key).toLowerCase()}
                <Badge tone={status.tone}>{status.label}</Badge>
              </p>
              <p className="mt-1 text-4xl font-extrabold tracking-tight text-ink">{formatBRL(invoice.total)}</p>
              <p className="mt-2 text-[13px] text-muted">
                Vencimento em <span className="font-semibold text-ink-2">{formatDate(invoice.dueDate)}</span> ·{' '}
                {invoice.items.length} {invoice.items.length === 1 ? 'compra' : 'compras'}
              </p>
            </div>
            {canPay && (
              <Button icon={CircleCheck} onClick={() => setPaying(true)}>
                Pagar fatura
              </Button>
            )}
            {invoice.status === 'paid' && (
              <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => setReopening(true)}>
                Reabrir
              </Button>
            )}
          </div>
        </Card>
        <Card>
          <p className="text-[13px] font-semibold text-ink-2">Limite do cartão</p>
          <p className="mt-1 text-2xl font-extrabold tracking-tight text-ink">{formatBRL(usage.available)}</p>
          <p className="mb-3 text-[13px] text-muted">disponível de {formatBRL(card.limit_cents)}</p>
          <ProgressBar
            value={usage.pct}
            tone={usage.pct >= 0.8 ? 'neg' : usage.pct >= 0.6 ? 'warn' : 'brand'}
            label={`${formatPercent(usage.pct)} do limite utilizado`}
          />
          <p className="tnum mt-2 text-xs text-muted">
            {formatBRL(usage.used)} utilizado ({formatPercent(usage.pct)})
          </p>
        </Card>
      </div>

      {invoices.length > 0 && (
        <div className="scroll-thin mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Faturas">
          {invoices.map((i) => (
            <button
              key={i.key}
              type="button"
              role="tab"
              aria-selected={i.key === key}
              onClick={() => setSelectedKey(i.key)}
              className={cn(
                'shrink-0 rounded-xl border px-3.5 py-2 text-left transition-colors',
                i.key === key ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:bg-surface-2',
              )}
            >
              <span className="flex items-center gap-1.5 text-xs font-bold text-ink-2">
                {monthShort(i.key)}
                {(i.status === 'overdue' || i.status === 'closed') && (
                  <span
                    className={cn('size-1.5 rounded-full', i.status === 'overdue' ? 'bg-neg' : 'bg-warn')}
                    aria-label={STATUS[i.status].label}
                  />
                )}
              </span>
              <span className="tnum block text-[13px] font-bold text-ink">{formatBRL(i.total)}</span>
            </button>
          ))}
        </div>
      )}

      <Card padded={false}>
        <TransactionTable
          transactions={invoice.items}
          empty={
            <EmptyState
              icon={Receipt}
              title="Nenhuma compra nesta fatura"
              description="As compras feitas neste cartão aparecem aqui, na fatura do período em que foram feitas."
            />
          }
        />
      </Card>

      {paying && (
        <PayInvoiceModal
          invoice={invoice}
          onClose={() => setPaying(false)}
          onPay={(accountId) => db.run(() => payInvoice(invoice.items, accountId), 'Fatura paga')}
        />
      )}

      <ConfirmDialog
        open={reopening}
        onClose={() => setReopening(false)}
        title="Reabrir fatura?"
        description="As compras voltam a contar no limite utilizado e o valor é devolvido ao saldo da conta."
        confirmLabel="Reabrir"
        danger={false}
        onConfirm={() => db.run(() => reopenInvoice(invoice.items), 'Fatura reaberta')}
      />
    </>
  )
}

interface PayInvoiceModalProps {
  invoice: Invoice
  onClose: () => void
  onPay: (accountId: string | null) => Promise<unknown>
}

function PayInvoiceModal({ invoice, onClose, onPay }: PayInvoiceModalProps) {
  const { accounts } = useFinance()
  const [accountId, setAccountId] = useState(accounts.find((a) => a.type !== 'investment')?.id ?? '')
  const [busy, setBusy] = useState(false)

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Pagar fatura"
      description={`${formatBRL(invoice.total)} · vencimento ${formatDate(invoice.dueDate)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true)
              const ok = await onPay(accountId || null)
              setBusy(false)
              if (ok) onClose()
            }}
          >
            Confirmar pagamento
          </Button>
        </>
      }
    >
      <Field label="Pagar com a conta" hint="O valor sai do saldo desta conta e o limite do cartão é liberado.">
        {(id) => (
          <Select id={id} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Não debitar de nenhuma conta</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </Modal>
  )
}
