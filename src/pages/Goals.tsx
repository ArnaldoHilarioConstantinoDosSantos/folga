import { useMemo, useState, type FormEvent } from 'react'
import { Plus, ShieldCheck, Target, Trash2 } from 'lucide-react'
import { ColorPicker, IconPicker } from '@/components/ColorPicker'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { GoalCard } from '@/components/GoalCard'
import { PageHeader } from '@/components/PageHeader'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ProgressBar, Segmented } from '@/components/ui/Feedback'
import { Field, Input, MoneyInput, Select } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { useFinance } from '@/contexts/FinanceContext'
import { useDb } from '@/hooks/useDb'
import { cn } from '@/lib/cn'
import type { ColorKey, Goal, GoalKind } from '@/types'
import { formatDate, todayISO } from '@/utils/date'
import { emergencyReserve, goalStatus } from '@/utils/finance'
import { formatBRL, formatNumber } from '@/utils/money'

export default function Goals() {
  const data = useFinance()
  const db = useDb()
  const today = todayISO()
  const [form, setForm] = useState<{ editing?: Goal; kind?: GoalKind } | null>(null)
  const [depositing, setDepositing] = useState<Goal | null>(null)
  const [deleting, setDeleting] = useState<Goal | null>(null)

  const statuses = useMemo(
    () =>
      data.goals
        .map((g) => goalStatus(data, g, today))
        .sort((a, b) => Number(b.goal.kind === 'emergency') - Number(a.goal.kind === 'emergency')),
    [data, today],
  )
  const reserve = useMemo(() => emergencyReserve(data, today), [data, today])
  const months = Math.floor(reserve.months)

  return (
    <>
      <PageHeader
        title="Metas"
        subtitle="Objetivos financeiros e sua reserva de emergência."
        actions={
          <Button icon={Plus} onClick={() => setForm({})}>
            Nova meta
          </Button>
        }
      />

      {/* Reserva de emergência */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <ShieldCheck className="size-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-bold text-ink">Reserva de emergência</h2>
            {reserve.exists ? (
              <>
                <p className="mt-1 text-sm text-ink-2">
                  {reserve.averageExpense > 0 ? (
                    <>
                      Sua reserva cobre aproximadamente{' '}
                      <strong className="font-extrabold text-ink">
                        {months >= 1
                          ? `${months} ${months === 1 ? 'mês' : 'meses'}`
                          : 'menos de 1 mês'}
                      </strong>{' '}
                      dos seus gastos atuais.
                    </>
                  ) : (
                    'Registre despesas para calcular quantos meses a reserva cobre.'
                  )}
                </p>
                <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                  <Stat label="Valor atual da reserva" value={formatBRL(reserve.amount)} />
                  <Stat label="Média mensal de despesas" value={formatBRL(reserve.averageExpense)} />
                  <Stat label="Cobertura" value={`${formatNumber(reserve.months)} meses`} />
                </dl>
                <div className="mt-4">
                  <ProgressBar
                    value={reserve.months / 6}
                    tone={reserve.months >= 6 ? 'pos' : reserve.months >= 3 ? 'warn' : 'neg'}
                    label={`Reserva cobre ${formatNumber(reserve.months)} de 6 meses recomendados`}
                  />
                  <p className="mt-1.5 text-xs text-muted">Referência: 6 meses de despesas guardados.</p>
                </div>
              </>
            ) : (
              <>
                <p className="mt-1 text-sm text-muted">
                  Você ainda não tem uma reserva. O recomendado é guardar o equivalente a 6 meses de despesas
                  {reserve.averageExpense > 0 && ` — cerca de ${formatBRL(reserve.averageExpense * 6)} no seu caso`}.
                </p>
                <Button variant="secondary" size="sm" icon={Plus} className="mt-3" onClick={() => setForm({ kind: 'emergency' })}>
                  Criar reserva de emergência
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {statuses.length === 0 ? (
        <Card>
          <EmptyState
            icon={Target}
            title="Nenhuma meta criada"
            description="Crie uma meta, registre depósitos e acompanhe o progresso até chegar lá."
            action={
              <Button icon={Plus} onClick={() => setForm({})}>
                Nova meta
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {statuses.map((status) => (
            <GoalCard
              key={status.goal.id}
              status={status}
              onDeposit={() => setDepositing(status.goal)}
              onEdit={() => setForm({ editing: status.goal })}
              onDelete={() => setDeleting(status.goal)}
            />
          ))}
        </div>
      )}

      {form && <GoalForm editing={form.editing} kind={form.kind} onClose={() => setForm(null)} />}
      {depositing && <DepositModal goal={depositing} onClose={() => setDepositing(null)} />}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Excluir meta?"
        description={`A meta "${deleting?.name ?? ''}" e todo o histórico de depósitos serão excluídos.`}
        onConfirm={async () => {
          if (deleting) await db.remove('financial_goals', deleting.id, 'Meta excluída')
        }}
      />
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="text-lg font-extrabold tracking-tight text-ink">{value}</dd>
    </div>
  )
}

function GoalForm({ editing, kind, onClose }: { editing?: Goal; kind?: GoalKind; onClose: () => void }) {
  const db = useDb()
  const initialKind = editing?.kind ?? kind ?? 'goal'
  const [goalKind, setGoalKind] = useState<GoalKind>(initialKind)
  const [name, setName] = useState(editing?.name ?? (initialKind === 'emergency' ? 'Reserva de emergência' : ''))
  const [target, setTarget] = useState(editing?.target_cents ?? 0)
  const [targetDate, setTargetDate] = useState(editing?.target_date ?? '')
  const [icon, setIcon] = useState(editing?.icon ?? (initialKind === 'emergency' ? 'shield' : 'target'))
  const [color, setColor] = useState<ColorKey>(editing?.color ?? (initialKind === 'emergency' ? 'green' : 'blue'))
  const [errors, setErrors] = useState<{ name?: string; target?: string }>({})
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const next: typeof errors = {}
    if (!name.trim()) next.name = 'Dê um nome à meta.'
    if (target <= 0) next.target = 'Informe o valor da meta.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const row = {
      name: name.trim(),
      target_cents: target,
      target_date: targetDate || null,
      icon,
      color,
      kind: goalKind,
    }
    setSaving(true)
    const ok = editing
      ? await db.update('financial_goals', editing.id, row, 'Meta atualizada')
      : await db.create('financial_goals', row, 'Meta criada')
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Editar meta' : 'Nova meta'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="goal-form" loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="goal-form" onSubmit={submit} className="space-y-4" noValidate>
        <Segmented
          label="Tipo de meta"
          value={goalKind}
          onChange={setGoalKind}
          className="flex w-full"
          options={[
            { value: 'goal', label: 'Meta' },
            { value: 'emergency', label: 'Reserva de emergência' },
          ]}
        />
        <Field label="Nome" error={errors.name}>
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Viagem" maxLength={60} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor da meta" error={errors.target}>
            {(id) => <MoneyInput id={id} value={target} onChange={setTarget} />}
          </Field>
          <Field label="Data desejada" hint="Opcional.">
            {(id) => <Input id={id} type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />}
          </Field>
        </div>
        <div>
          <p className="mb-2 text-[13px] font-semibold text-ink-2">Cor</p>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <div>
          <p className="mb-2 text-[13px] font-semibold text-ink-2">Ícone</p>
          <IconPicker value={icon} onChange={setIcon} color={color} />
        </div>
      </form>
    </Modal>
  )
}

function DepositModal({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const data = useFinance()
  const db = useDb()
  const [mode, setMode] = useState<'in' | 'out'>('in')
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(todayISO())
  const [accountId, setAccountId] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const history = data.contributions
    .filter((c) => c.goal_id === goal.id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
  const saved = history.reduce((sum, c) => sum + c.amount_cents, 0)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (amount <= 0) return setError('Informe um valor maior que zero.')
    if (mode === 'out' && amount > saved) return setError(`O valor guardado é ${formatBRL(saved)}.`)
    if (!date) return setError('Informe a data.')
    setSaving(true)
    setError(null)
    const ok = await db.create(
      'goal_contributions',
      {
        goal_id: goal.id,
        amount_cents: mode === 'in' ? amount : -amount,
        date,
        account_id: accountId || null,
        note: note.trim() || null,
      },
      mode === 'in' ? 'Depósito registrado' : 'Retirada registrada',
    )
    setSaving(false)
    if (ok) {
      setAmount(0)
      setNote('')
    }
  }

  return (
    <Modal open onClose={onClose} title={goal.name} description={`Guardado: ${formatBRL(saved)} de ${formatBRL(goal.target_cents)}`}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Segmented
          label="Operação"
          value={mode}
          onChange={setMode}
          className="flex w-full"
          options={[
            { value: 'in', label: 'Depositar' },
            { value: 'out', label: 'Retirar' },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor" error={error ?? undefined}>
            {(id) => <MoneyInput id={id} value={amount} onChange={setAmount} />}
          </Field>
          <Field label="Data">
            {(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
          <Field
            label={mode === 'in' ? 'Sai da conta' : 'Volta para a conta'}
            hint="Opcional. Ajusta o saldo da conta sem contar como despesa."
          >
            {(id) => (
              <Select id={id} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">Nenhuma conta</option>
                {data.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Observação">
            {(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" maxLength={120} />}
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            {mode === 'in' ? 'Registrar depósito' : 'Registrar retirada'}
          </Button>
        </div>
      </form>

      <div className="mt-6 border-t border-line pt-4">
        <h3 className="mb-2 text-[13px] font-bold text-ink-2">Histórico</h3>
        {history.length === 0 ? (
          <p className="text-[13px] text-muted">Nenhum depósito registrado ainda.</p>
        ) : (
          <ul className="divide-y divide-line">
            {history.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="tnum text-[13px] font-semibold text-ink">{formatDate(c.date)}</p>
                  {c.note && <p className="truncate text-xs text-muted">{c.note}</p>}
                </div>
                <span className={cn('tnum text-sm font-bold', c.amount_cents < 0 ? 'text-neg' : 'text-pos')}>
                  {formatBRL(c.amount_cents, { sign: true })}
                </span>
                <IconButton
                  icon={Trash2}
                  label={`Excluir movimento de ${formatDate(c.date)}`}
                  tone="danger"
                  onClick={() => db.remove('goal_contributions', c.id, 'Movimento excluído')}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
