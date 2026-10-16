import { useState, type FormEvent } from 'react'
import { CreditCard as CardIcon, Plus } from 'lucide-react'
import { ColorPicker } from '@/components/ColorPicker'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { CreditCardCard } from '@/components/CreditCardCard'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/Feedback'
import { Field, Input, MoneyInput } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { useFinance } from '@/contexts/FinanceContext'
import { useDb } from '@/hooks/useDb'
import type { ColorKey, CreditCard } from '@/types'
import { cardInvoices, cardUsage, totalCardUsage } from '@/utils/finance'
import { formatBRL, formatPercent } from '@/utils/money'

export default function Cards() {
  const data = useFinance()
  const db = useDb()
  const [form, setForm] = useState<{ editing?: CreditCard } | null>(null)
  const [deleting, setDeleting] = useState<CreditCard | null>(null)
  const total = totalCardUsage(data)

  return (
    <>
      <PageHeader
        title="Cartões"
        subtitle="Limite, faturas e compras de cada cartão de crédito."
        actions={
          <Button icon={Plus} onClick={() => setForm({})}>
            Novo cartão
          </Button>
        }
      />

      {data.cards.length === 0 ? (
        <Card>
          <EmptyState
            icon={CardIcon}
            title="Nenhum cartão cadastrado"
            description="Cadastre seus cartões para acompanhar o limite utilizado e as faturas."
            action={
              <Button icon={Plus} onClick={() => setForm({})}>
                Novo cartão
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {data.cards.length > 1 && (
            <Card className="mb-6">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-ink">
                  {formatPercent(total.pct)} do limite total utilizado
                </p>
                <p className="tnum text-[13px] text-muted">
                  {formatBRL(total.used)} de {formatBRL(total.limit)}
                </p>
              </div>
              <ProgressBar
                value={total.pct}
                tone={total.pct > 0.6 ? 'neg' : total.pct > 0.3 ? 'warn' : 'brand'}
                label={`Limite total: ${formatPercent(total.pct)} utilizado`}
              />
            </Card>
          )}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.cards.map((card) => {
              const usage = cardUsage(data, card)
              const open = cardInvoices(data, card).find((i) => i.status === 'open')
              return (
                <CreditCardCard
                  key={card.id}
                  card={card}
                  {...usage}
                  openInvoice={open?.total}
                  onEdit={() => setForm({ editing: card })}
                  onDelete={() => setDeleting(card)}
                />
              )
            })}
          </div>
        </>
      )}

      {form && <CardForm editing={form.editing} onClose={() => setForm(null)} />}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Excluir cartão?"
        description={`O cartão "${deleting?.name ?? ''}" será removido. As compras feitas nele continuam nos lançamentos, sem cartão vinculado.`}
        onConfirm={async () => {
          if (deleting) await db.remove('credit_cards', deleting.id, 'Cartão excluído')
        }}
      />
    </>
  )
}

function CardForm({ editing, onClose }: { editing?: CreditCard; onClose: () => void }) {
  const db = useDb()
  const [name, setName] = useState(editing?.name ?? '')
  const [bank, setBank] = useState(editing?.bank ?? '')
  const [limit, setLimit] = useState(editing?.limit_cents ?? 0)
  const [closing, setClosing] = useState(String(editing?.closing_day ?? 25))
  const [due, setDue] = useState(String(editing?.due_day ?? 5))
  const [color, setColor] = useState<ColorKey>(editing?.color ?? 'violet')
  const [errors, setErrors] = useState<{ name?: string; limit?: string; days?: string }>({})
  const [saving, setSaving] = useState(false)

  const validDay = (value: string) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 31

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const next: typeof errors = {}
    if (!name.trim()) next.name = 'Informe o nome do cartão.'
    if (limit <= 0) next.limit = 'Informe o limite.'
    if (!validDay(closing) || !validDay(due)) next.days = 'Use dias entre 1 e 31.'
    else if (closing === due) next.days = 'Fechamento e vencimento precisam ser dias diferentes.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const row = {
      name: name.trim(),
      bank: bank.trim(),
      limit_cents: limit,
      closing_day: Number(closing),
      due_day: Number(due),
      color,
    }
    setSaving(true)
    const ok = editing
      ? await db.update('credit_cards', editing.id, row, 'Cartão atualizado')
      : await db.create('credit_cards', row, 'Cartão criado')
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Editar cartão' : 'Novo cartão'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="card-form" loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="card-form" onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" error={errors.name}>
            {(id) => (
              <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Nubank" maxLength={60} />
            )}
          </Field>
          <Field label="Banco">
            {(id) => (
              <Input id={id} value={bank} onChange={(e) => setBank(e.target.value)} placeholder="Ex.: Nu Pagamentos" maxLength={60} />
            )}
          </Field>
        </div>
        <Field label="Limite" error={errors.limit}>
          {(id) => <MoneyInput id={id} value={limit} onChange={setLimit} />}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Dia de fechamento" error={errors.days}>
            {(id) => (
              <Input id={id} type="number" inputMode="numeric" min={1} max={31} value={closing} onChange={(e) => setClosing(e.target.value)} />
            )}
          </Field>
          <Field label="Dia de vencimento">
            {(id) => (
              <Input id={id} type="number" inputMode="numeric" min={1} max={31} value={due} onChange={(e) => setDue(e.target.value)} />
            )}
          </Field>
        </div>
        <div>
          <p className="mb-2 text-[13px] font-semibold text-ink-2">Cor</p>
          <ColorPicker value={color} onChange={setColor} />
        </div>
      </form>
    </Modal>
  )
}
