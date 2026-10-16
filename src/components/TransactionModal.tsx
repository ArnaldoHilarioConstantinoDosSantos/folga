import { useRef, useState, type FormEvent } from 'react'
import { Copy, Trash2 } from 'lucide-react'
import { useFinance } from '@/contexts/FinanceContext'
import { useDb } from '@/hooks/useDb'
import { createRepeatingTransaction } from '@/services/operations'
import type { NewRow, PaymentMethod, Transaction, TxType } from '@/types'
import { todayISO } from '@/utils/date'
import { PAYMENT_METHODS, optionsOf } from '@/utils/labels'
import { CategorySelect } from './CategorySelect'
import { ConfirmDialog } from './ConfirmDialog'
import { Button } from './ui/Button'
import { Segmented } from './ui/Feedback'
import { Field, Input, MoneyInput, Select, Textarea, Toggle } from './ui/Form'
import { Modal } from './ui/Modal'

export type TransactionDefaults = Partial<
  Pick<
    Transaction,
    | 'type' | 'description' | 'amount_cents' | 'category_id' | 'date'
    | 'payment_method' | 'account_id' | 'card_id' | 'notes'
  >
>

interface TransactionModalProps {
  open: boolean
  onClose: () => void
  /** Lançamento em edição; ausente = novo lançamento. */
  editing?: Transaction
  defaults?: TransactionDefaults
  onDuplicate?: (tx: Transaction) => void
}

interface FormState {
  type: TxType
  description: string
  amount: number
  categoryId: string | null
  date: string
  method: PaymentMethod
  accountId: string | null
  cardId: string | null
  notes: string
  paid: boolean
  repeat: boolean
}

type Errors = Partial<Record<'description' | 'amount' | 'date' | 'card', string>>

const TYPE_OPTIONS: Array<{ value: TxType; label: string }> = [
  { value: 'expense', label: 'Despesa' },
  { value: 'income', label: 'Receita' },
]

export function TransactionModal({ open, onClose, editing, defaults, onDuplicate }: TransactionModalProps) {
  const { accounts, cards } = useFinance()
  const db = useDb()
  const today = todayISO()
  const source = editing ?? defaults

  const [form, setForm] = useState<FormState>(() => {
    const date = source?.date ?? today
    const cardId = source?.card_id ?? null
    return {
      type: source?.type ?? 'expense',
      description: source?.description ?? '',
      amount: source?.amount_cents ?? 0,
      categoryId: source?.category_id ?? null,
      date,
      method: source?.payment_method ?? (cardId ? 'credit' : 'pix'),
      accountId: source?.account_id ?? accounts[0]?.id ?? null,
      cardId: cardId ?? cards[0]?.id ?? null,
      notes: source?.notes ?? '',
      paid: editing ? editing.paid : date <= today,
      repeat: false,
    }
  })
  const [paidTouched, setPaidTouched] = useState(Boolean(editing))
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const [addAnother, setAddAnother] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const descriptionRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))
  const onCard = form.type === 'expense' && form.method === 'credit'
  const methods = optionsOf(PAYMENT_METHODS).filter(
    (m) => m.value !== 'credit' || (form.type === 'expense' && cards.length > 0),
  )

  const changeType = (type: TxType) =>
    setForm((f) => ({
      ...f,
      type,
      categoryId: null,
      method: type === 'income' && f.method === 'credit' ? 'pix' : f.method,
    }))

  const changeDate = (date: string) =>
    setForm((f) => ({ ...f, date, paid: paidTouched ? f.paid : date !== '' && date <= today }))

  const validate = (): boolean => {
    const next: Errors = {}
    if (!form.description.trim()) next.description = 'Informe uma descrição.'
    if (form.amount <= 0) next.amount = 'Informe um valor maior que zero.'
    if (!form.date) next.date = 'Informe a data.'
    if (onCard && !form.cardId) next.card = 'Escolha o cartão.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!validate()) return
    setSaving(true)

    // No cartão, "pago" é decidido pelo pagamento da fatura, não pelo lançamento.
    const keepsInvoice = editing && onCard && editing.card_id === form.cardId
    const row: NewRow<'transactions'> = {
      description: form.description.trim(),
      amount_cents: form.amount,
      type: form.type,
      category_id: form.categoryId,
      date: form.date,
      payment_method: form.method,
      account_id: onCard ? (keepsInvoice && editing.paid ? editing.account_id : null) : form.accountId,
      card_id: onCard ? form.cardId : null,
      notes: form.notes.trim() || null,
      paid: onCard ? Boolean(keepsInvoice && editing.paid) : form.paid,
      recurring_id: editing?.recurring_id ?? null,
      installment_id: editing?.installment_id ?? null,
      installment_number: editing?.installment_number ?? null,
      installment_total: editing?.installment_total ?? null,
    }

    const ok = editing
      ? await db.update('transactions', editing.id, row, 'Lançamento atualizado')
      : form.repeat
        ? await db.run(() => createRepeatingTransaction(row), 'Lançamento recorrente criado')
        : await db.create('transactions', row, 'Lançamento adicionado')

    setSaving(false)
    if (!ok) return
    if (addAnother && !editing) {
      setForm((f) => ({ ...f, description: '', amount: 0, notes: '', repeat: false }))
      setErrors({})
      descriptionRef.current?.focus()
    } else {
      onClose()
    }
  }

  const title = editing ? 'Editar lançamento' : 'Novo lançamento'

  return (
    <>
      <Modal open={open} onClose={onClose} title={title}>
        <form id="transaction-form" onSubmit={submit} className="space-y-4" noValidate>
          <Segmented
            label="Tipo de lançamento"
            value={form.type}
            onChange={changeType}
            options={TYPE_OPTIONS}
            className="flex w-full"
          />

          <Field label="Valor" error={errors.amount}>
            {(id) => (
              <MoneyInput
                id={id}
                size="lg"
                value={form.amount}
                onChange={(v) => set('amount', v)}
                aria-invalid={Boolean(errors.amount)}
                data-autofocus={editing ? undefined : true}
              />
            )}
          </Field>

          <Field label="Descrição" error={errors.description}>
            {(id) => (
              <Input
                id={id}
                ref={descriptionRef}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder={form.type === 'expense' ? 'Ex.: Supermercado' : 'Ex.: Salário'}
                maxLength={120}
                aria-invalid={Boolean(errors.description)}
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Categoria">
              {(id) => (
                <CategorySelect id={id} type={form.type} value={form.categoryId} onChange={(v) => set('categoryId', v)} />
              )}
            </Field>
            <Field label="Data" error={errors.date}>
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={form.date}
                  onChange={(e) => changeDate(e.target.value)}
                  aria-invalid={Boolean(errors.date)}
                />
              )}
            </Field>
            <Field label="Forma de pagamento">
              {(id) => (
                <Select id={id} value={form.method} onChange={(e) => set('method', e.target.value as PaymentMethod)}>
                  {methods.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {onCard ? (
              <Field label="Cartão" error={errors.card}>
                {(id) => (
                  <Select id={id} value={form.cardId ?? ''} onChange={(e) => set('cardId', e.target.value || null)}>
                    {cards.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ) : (
              <Field label="Conta">
                {(id) => (
                  <Select id={id} value={form.accountId ?? ''} onChange={(e) => set('accountId', e.target.value || null)}>
                    <option value="">Nenhuma</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
          </div>

          <Field label="Observação">
            {(id) => (
              <Textarea
                id={id}
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Opcional"
                maxLength={500}
              />
            )}
          </Field>

          <div className="space-y-3 rounded-xl bg-surface-2 p-4">
            {onCard ? (
              <p className="text-[13px] text-ink-2">
                Compras no cartão entram na fatura e são quitadas quando você paga a fatura.
              </p>
            ) : (
              <Toggle
                label={form.type === 'expense' ? 'Já foi pago' : 'Já foi recebido'}
                description="Desligado, o lançamento fica como pendente."
                checked={form.paid}
                onChange={(v) => {
                  setPaidTouched(true)
                  set('paid', v)
                }}
              />
            )}
            {!editing && (
              <Toggle
                label="Repetir todo mês"
                description="Cria um lançamento recorrente neste mesmo dia."
                checked={form.repeat}
                onChange={(v) => set('repeat', v)}
              />
            )}
          </div>
        </form>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {editing ? (
            <>
              <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setConfirmDelete(true)}>
                Excluir
              </Button>
              {onDuplicate && (
                <Button variant="ghost" size="sm" icon={Copy} onClick={() => onDuplicate(editing)}>
                  Duplicar
                </Button>
              )}
            </>
          ) : (
            <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
              <input
                type="checkbox"
                checked={addAnother}
                onChange={(e) => setAddAnother(e.target.checked)}
                className="size-4 rounded accent-[var(--brand)]"
              />
              Adicionar outro
            </label>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" form="transaction-form" loading={saving}>
              {editing ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </div>
      </Modal>

      {editing && (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title="Excluir lançamento?"
          description={`"${editing.description}" será excluído. Esta ação não pode ser desfeita.`}
          onConfirm={async () => {
            if (await db.remove('transactions', editing.id, 'Lançamento excluído')) onClose()
          }}
        />
      )}
    </>
  )
}
