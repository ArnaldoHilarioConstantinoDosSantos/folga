import { useMemo, useState, type FormEvent } from 'react'
import { CalendarRange, Layers, Pencil, Plus, Trash2, Wallet } from 'lucide-react'
import { CategoryIcon } from '@/components/CategoryIcon'
import { CategorySelect } from '@/components/CategorySelect'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge, ProgressBar } from '@/components/ui/Feedback'
import { Field, Input, MoneyInput, Select, Textarea } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { useFinance } from '@/contexts/FinanceContext'
import { useDb } from '@/hooks/useDb'
import { createInstallment, updateInstallment } from '@/services/operations'
import type { Installment } from '@/types'
import { addMonthsToDate, monthLabelSlash, monthOf, monthShort, todayISO } from '@/utils/date'
import { categoryIndex, installmentStatus, type InstallmentStatus } from '@/utils/finance'
import { colorVar } from '@/utils/labels'
import { formatBRL, splitInstallments, sumBy } from '@/utils/money'

export default function Installments() {
  const data = useFinance()
  const db = useDb()
  const today = todayISO()
  const [form, setForm] = useState<{ editing?: Installment } | null>(null)
  const [deleting, setDeleting] = useState<Installment | null>(null)

  const { active, finished } = useMemo(() => {
    const all = data.installments.map((i) => installmentStatus(data, i, today))
    return {
      active: all.filter((s) => !s.finished).sort((a, b) => a.lastDate.localeCompare(b.lastDate)),
      finished: all.filter((s) => s.finished),
    }
  }, [data, today])

  const index = categoryIndex(data.categories)
  const cardName = new Map(data.cards.map((c) => [c.id, c.name]))

  const item = (s: InstallmentStatus) => {
    const root = index.rootOf(s.installment.category_id)
    const category = index.byId.get(s.installment.category_id ?? '')
    const count = s.installment.count
    const paidCount = count - s.remainingCount
    return (
      <Card key={s.installment.id} className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <CategoryIcon icon={category?.icon ?? root?.icon} color={root?.color} size="lg" />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-bold text-ink">{s.installment.description}</h3>
            <p className="truncate text-[13px] text-muted">
              {s.installment.card_id ? (cardName.get(s.installment.card_id) ?? 'Cartão') : 'Sem cartão'} · até{' '}
              {monthShort(monthOf(s.lastDate))}
            </p>
          </div>
          <div className="-mt-1 -mr-2 flex">
            <IconButton
              icon={Pencil}
              label={`Editar ${s.installment.description}`}
              onClick={() => setForm({ editing: s.installment })}
            />
            <IconButton
              icon={Trash2}
              label={`Excluir ${s.installment.description}`}
              tone="danger"
              onClick={() => setDeleting(s.installment)}
            />
          </div>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted">Parcela</p>
            <p className="text-xl font-extrabold tracking-tight text-ink">
              {formatBRL(s.parcel)}
              <span className="text-sm font-semibold text-muted">/mês</span>
            </p>
          </div>
          <Badge tone={s.finished ? 'pos' : 'brand'} className="text-sm">
            {s.finished ? 'Quitado' : `${Math.max(1, s.current)}/${count}`}
          </Badge>
        </div>

        <div>
          <ProgressBar
            value={paidCount / count}
            color={colorVar(root?.color ?? 'blue')}
            label={`${s.installment.description}: ${paidCount} de ${count} parcelas pagas`}
          />
          <div className="mt-2 flex justify-between gap-3 text-xs text-muted">
            <span>
              {s.remainingCount} {s.remainingCount === 1 ? 'parcela restante' : 'parcelas restantes'}
            </span>
            <span>
              Restante: <span className="tnum font-bold text-ink">{formatBRL(s.remainingAmount)}</span>
            </span>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <>
      <PageHeader
        title="Parcelamentos"
        subtitle="Compras parceladas, com cada parcela lançada no mês correspondente."
        actions={
          <Button icon={Plus} onClick={() => setForm({})}>
            Nova compra parcelada
          </Button>
        }
      />

      {data.installments.length === 0 ? (
        <Card>
          <EmptyState
            icon={Layers}
            title="Nenhuma compra parcelada"
            description="Cadastre uma compra e as parcelas são geradas automaticamente, mês a mês."
            action={
              <Button icon={Plus} onClick={() => setForm({})}>
                Nova compra parcelada
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <section aria-label="Resumo dos parcelamentos" className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatCard label="Parcelamentos ativos" value={String(active.length)} icon={Layers} tone="brand" />
            <StatCard
              label="Parcelas por mês"
              value={formatBRL(sumBy(active, (s) => s.parcel))}
              icon={CalendarRange}
              hint="Soma das parcelas em andamento"
            />
            <StatCard
              label="Ainda a pagar"
              value={formatBRL(sumBy(active, (s) => s.remainingAmount))}
              icon={Wallet}
              tone="warn"
            />
          </section>

          <h2 className="mb-3 text-[15px] font-bold text-ink">Parcelamentos ativos</h2>
          {active.length === 0 ? (
            <Card>
              <EmptyState compact icon={Layers} title="Nenhum parcelamento em andamento" />
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{active.map(item)}</div>
          )}

          {finished.length > 0 && (
            <>
              <h2 className="mt-8 mb-3 text-[15px] font-bold text-ink">Concluídos</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{finished.map(item)}</div>
            </>
          )}
        </>
      )}

      {form && <InstallmentForm editing={form.editing} onClose={() => setForm(null)} />}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Excluir parcelamento?"
        description={`"${deleting?.description ?? ''}" e todas as suas parcelas, inclusive as já pagas, serão excluídos.`}
        onConfirm={async () => {
          if (deleting) await db.remove('installments', deleting.id, 'Parcelamento excluído')
        }}
      />
    </>
  )
}

function InstallmentForm({ editing, onClose }: { editing?: Installment; onClose: () => void }) {
  const { cards, accounts, transactions } = useFinance()
  const db = useDb()
  const [description, setDescription] = useState(editing?.description ?? '')
  const [total, setTotal] = useState(editing?.total_cents ?? 0)
  const [count, setCount] = useState(String(editing?.count ?? 12))
  const [firstDate, setFirstDate] = useState(editing?.first_date ?? todayISO())
  const [categoryId, setCategoryId] = useState(editing?.category_id ?? null)
  // "card:<id>" ou "account:<id>" — a origem do pagamento em um único seletor.
  const [source, setSource] = useState(
    editing?.card_id
      ? `card:${editing.card_id}`
      : editing?.account_id
        ? `account:${editing.account_id}`
        : cards[0]
          ? `card:${cards[0].id}`
          : accounts[0]
            ? `account:${accounts[0].id}`
            : '',
  )
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [errors, setErrors] = useState<{ description?: string; total?: string; count?: string; date?: string }>({})
  const [saving, setSaving] = useState(false)

  const n = Number(count)
  const validCount = Number.isInteger(n) && n >= 2 && n <= 120
  const parcels = validCount && total > 0 ? splitInstallments(total, n) : []

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const next: typeof errors = {}
    if (!description.trim()) next.description = 'Informe o que foi comprado.'
    if (!editing) {
      if (total <= 0) next.total = 'Informe o valor total.'
      if (!validCount) next.count = 'Use de 2 a 120 parcelas.'
      if (!firstDate) next.date = 'Informe a data da primeira parcela.'
    }
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    let ok: unknown
    if (editing) {
      const patch = { description: description.trim(), category_id: categoryId, notes: notes.trim() || null }
      ok = await db.run(() => updateInstallment(editing.id, patch, transactions), 'Parcelamento atualizado')
    } else {
      const [kind, id] = source.split(':')
      const cardId = kind === 'card' ? id : null
      ok = await db.run(
        () =>
          createInstallment({
            description: description.trim(),
            total_cents: total,
            count: n,
            first_date: firstDate,
            category_id: categoryId,
            card_id: cardId,
            account_id: kind === 'account' ? id : null,
            payment_method: cardId ? 'credit' : 'boleto',
            notes: notes.trim() || null,
          }),
        `${n} parcelas geradas`,
      )
    }
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Editar parcelamento' : 'Nova compra parcelada'}
      description={editing ? 'Valor e parcelas não mudam depois de criados; para isso, exclua e crie de novo.' : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="installment-form" loading={saving}>
            {editing ? 'Salvar' : 'Gerar parcelas'}
          </Button>
        </>
      }
    >
      <form id="installment-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Descrição" error={errors.description}>
          {(id) => (
            <Input id={id} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Geladeira" maxLength={120} />
          )}
        </Field>

        {!editing && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Valor total" error={errors.total}>
                {(id) => <MoneyInput id={id} value={total} onChange={setTotal} />}
              </Field>
              <Field label="Número de parcelas" error={errors.count}>
                {(id) => (
                  <Input id={id} type="number" inputMode="numeric" min={2} max={120} value={count} onChange={(e) => setCount(e.target.value)} />
                )}
              </Field>
              <Field label="Primeira parcela" error={errors.date}>
                {(id) => <Input id={id} type="date" value={firstDate} onChange={(e) => setFirstDate(e.target.value)} />}
              </Field>
              <Field label="Pagar com">
                {(id) => (
                  <Select id={id} value={source} onChange={(e) => setSource(e.target.value)}>
                    {cards.length > 0 && (
                      <optgroup label="Cartões">
                        {cards.map((c) => (
                          <option key={c.id} value={`card:${c.id}`}>
                            {c.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Contas (boleto ou débito)">
                      {accounts.map((a) => (
                        <option key={a.id} value={`account:${a.id}`}>
                          {a.name}
                        </option>
                      ))}
                      <option value="">Sem conta</option>
                    </optgroup>
                  </Select>
                )}
              </Field>
            </div>

            {parcels.length > 0 && firstDate && (
              <p className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-medium text-brand">
                <span className="font-extrabold">
                  {n}x {formatBRL(parcels.at(-1)!)}
                </span>{' '}
                · de {monthLabelSlash(monthOf(firstDate))} a {monthLabelSlash(monthOf(addMonthsToDate(firstDate, n - 1)))}
                {parcels[0] !== parcels.at(-1) && ` · 1ª parcela de ${formatBRL(parcels[0])}`}
              </p>
            )}
          </>
        )}

        <Field label="Categoria">
          {(id) => <CategorySelect id={id} type="expense" value={categoryId} onChange={setCategoryId} />}
        </Field>
        <Field label="Observação">
          {(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" maxLength={500} />}
        </Field>
      </form>
    </Modal>
  )
}
