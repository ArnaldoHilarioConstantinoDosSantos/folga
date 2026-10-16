import { useState, type FormEvent } from 'react'
import { useFinance } from '@/contexts/FinanceContext'
import { useDb } from '@/hooks/useDb'
import { createRecurring, updateRecurring } from '@/services/operations'
import type { Frequency, NewRow, PaymentMethod, Recurring, TxType } from '@/types'
import { WEEKDAYS, currentMonth, dayOf, monthNumber, startOfMonth, todayISO } from '@/utils/date'
import { FREQUENCIES, PAYMENT_METHODS, optionsOf } from '@/utils/labels'
import { CategorySelect } from './CategorySelect'
import { Button } from './ui/Button'
import { Field, Input, MoneyInput, Select, Toggle } from './ui/Form'
import { Modal } from './ui/Modal'

interface RecurringModalProps {
  open: boolean
  onClose: () => void
  type: TxType
  editing?: Recurring
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

/** Cadastro de gasto fixo (despesa) ou de renda mensal (receita). */
export function RecurringModal({ open, onClose, type, editing }: RecurringModalProps) {
  const { accounts, cards, transactions } = useFinance()
  const db = useDb()
  const today = todayISO()

  const [description, setDescription] = useState(editing?.description ?? '')
  const [amount, setAmount] = useState(editing?.amount_cents ?? 0)
  const [categoryId, setCategoryId] = useState(editing?.category_id ?? null)
  const [frequency, setFrequency] = useState<Frequency>(editing?.frequency ?? 'monthly')
  const [day, setDay] = useState(String(editing?.day ?? dayOf(today)))
  const [weekday, setWeekday] = useState(editing?.weekday ?? 1)
  const [month, setMonth] = useState(editing?.month ?? monthNumber(today))
  const [method, setMethod] = useState<PaymentMethod>(editing?.payment_method ?? (type === 'income' ? 'transfer' : 'boleto'))
  const [accountId, setAccountId] = useState<string | null>(editing?.account_id ?? accounts[0]?.id ?? null)
  const [cardId, setCardId] = useState<string | null>(editing?.card_id ?? cards[0]?.id ?? null)
  const [endDate, setEndDate] = useState(editing?.end_date ?? '')
  const [active, setActive] = useState(editing?.active ?? true)
  const [errors, setErrors] = useState<{ description?: string; amount?: string; day?: string }>({})
  const [saving, setSaving] = useState(false)

  const onCard = type === 'expense' && method === 'credit'
  const methods = optionsOf(PAYMENT_METHODS).filter((m) => m.value !== 'credit' || (type === 'expense' && cards.length > 0))
  const noun = type === 'expense' ? 'gasto fixo' : 'renda'

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const dayNumber = Number(day)
    const next: typeof errors = {}
    if (!description.trim()) next.description = 'Informe uma descrição.'
    if (amount <= 0) next.amount = 'Informe um valor maior que zero.'
    if (frequency !== 'weekly' && !(dayNumber >= 1 && dayNumber <= 31)) next.day = 'Use um dia entre 1 e 31.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const row: NewRow<'recurring_transactions'> = {
      description: description.trim(),
      amount_cents: amount,
      type,
      category_id: categoryId,
      frequency,
      day: frequency === 'weekly' ? 1 : dayNumber,
      weekday: frequency === 'weekly' ? weekday : null,
      month: frequency === 'yearly' ? month : null,
      payment_method: method,
      account_id: onCard ? null : accountId,
      card_id: onCard ? cardId : null,
      active,
      start_date: editing?.start_date ?? startOfMonth(currentMonth()),
      end_date: endDate || null,
      generated_until: editing?.generated_until ?? null,
    }

    setSaving(true)
    const ok = editing
      ? await db.run(() => updateRecurring(editing, row, transactions), 'Alterações salvas')
      : await db.run(() => createRecurring(row), type === 'expense' ? 'Gasto fixo criado' : 'Renda cadastrada')
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Editar ${noun}` : type === 'expense' ? 'Novo gasto fixo' : 'Nova renda mensal'}
      description={
        type === 'expense'
          ? 'Aparece sozinho como despesa prevista a cada período.'
          : 'Entra como receita prevista a cada período.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="recurring-form" loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="recurring-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Descrição" error={errors.description}>
          {(id) => (
            <Input
              id={id}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={type === 'expense' ? 'Ex.: Condomínio' : 'Ex.: Salário'}
              maxLength={120}
              aria-invalid={Boolean(errors.description)}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor" error={errors.amount}>
            {(id) => <MoneyInput id={id} value={amount} onChange={setAmount} aria-invalid={Boolean(errors.amount)} />}
          </Field>
          <Field label="Categoria">
            {(id) => <CategorySelect id={id} type={type} value={categoryId} onChange={setCategoryId} />}
          </Field>
          <Field label="Frequência">
            {(id) => (
              <Select id={id} value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
                {optionsOf(FREQUENCIES).map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {frequency === 'weekly' ? (
            <Field label="Dia da semana">
              {(id) => (
                <Select id={id} value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
                  {WEEKDAYS.map((name, i) => (
                    <option key={name} value={i}>
                      {name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : (
            <Field label="Dia do mês" error={errors.day} hint="Em meses mais curtos, usa o último dia.">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  aria-invalid={Boolean(errors.day)}
                />
              )}
            </Field>
          )}

          {frequency === 'yearly' && (
            <Field label="Mês">
              {(id) => (
                <Select id={id} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                  {MONTH_NAMES.map((name, i) => (
                    <option key={name} value={i + 1}>
                      {name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}

          <Field label="Forma de pagamento">
            {(id) => (
              <Select id={id} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {methods.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {onCard ? (
            <Field label="Cartão">
              {(id) => (
                <Select id={id} value={cardId ?? ''} onChange={(e) => setCardId(e.target.value || null)}>
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
                <Select id={id} value={accountId ?? ''} onChange={(e) => setAccountId(e.target.value || null)}>
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
          <Field label="Termina em" hint="Opcional. Deixe vazio se não tem fim.">
            {(id) => <Input id={id} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />}
          </Field>
        </div>

        {editing && (
          <div className="rounded-xl bg-surface-2 p-4">
            <Toggle
              label="Ativo"
              description="Desativado, para de gerar lançamentos nos próximos meses."
              checked={active}
              onChange={setActive}
            />
          </div>
        )}
      </form>
    </Modal>
  )
}
