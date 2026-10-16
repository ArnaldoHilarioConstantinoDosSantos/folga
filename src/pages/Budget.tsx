import { useMemo, useState, type FormEvent } from 'react'
import { ChartPie, ClipboardList, Pencil, Plus, Trash2 } from 'lucide-react'
import { BudgetProgress } from '@/components/BudgetProgress'
import { CategorySelect } from '@/components/CategorySelect'
import { FinancialChart, type ChartSeries } from '@/components/charts/FinancialChart'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { MonthSelector } from '@/components/MonthSelector'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Button, IconButton } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Segmented } from '@/components/ui/Feedback'
import { Field, Input, MoneyInput } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { useFinance } from '@/contexts/FinanceContext'
import { useMonth } from '@/contexts/MonthContext'
import { useDb } from '@/hooks/useDb'
import { cn } from '@/lib/cn'
import type { Budget as BudgetRow, MonthlyPlan, PlanAllocation } from '@/types'
import { monthLabel, todayISO } from '@/utils/date'
import { budgetStatuses, categoryIndex, expectedIncome, planVersusActual } from '@/utils/finance'
import { formatBRL, formatPercent, ratio, sumBy } from '@/utils/money'

type Tab = 'limits' | 'plan'

const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'limits', label: 'Limites por categoria' },
  { value: 'plan', label: 'Planejamento do mês' },
]

export default function Budget() {
  const [tab, setTab] = useState<Tab>('limits')
  return (
    <>
      <PageHeader
        title="Orçamento"
        subtitle="Defina limites por categoria e planeje como distribuir sua renda."
        actions={<MonthSelector />}
      />
      <Segmented label="Visão" value={tab} onChange={setTab} options={TABS} className="mb-6 flex w-full sm:inline-flex sm:w-auto" />
      {tab === 'limits' ? <Limits /> : <Plan />}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Limites por categoria                                               */
/* ------------------------------------------------------------------ */

function Limits() {
  const data = useFinance()
  const db = useDb()
  const { month } = useMonth()
  const [form, setForm] = useState<{ editing?: BudgetRow } | null>(null)
  const [deleting, setDeleting] = useState<BudgetRow | null>(null)
  const statuses = useMemo(() => budgetStatuses(data, month, todayISO()), [data, month])

  const limit = sumBy(statuses, (s) => s.budget.limit_cents)
  const spent = sumBy(statuses, (s) => s.spent)
  const alerts = statuses.filter((s) => s.level !== 'ok').length

  if (statuses.length === 0) {
    return (
      <>
        <Card>
          <EmptyState
            icon={ChartPie}
            title="Nenhum limite definido"
            description="Crie um limite de gastos para uma categoria e acompanhe o quanto já foi usado no mês."
            action={
              <Button icon={Plus} onClick={() => setForm({})}>
                Novo limite
              </Button>
            }
          />
        </Card>
        {form && <BudgetForm onClose={() => setForm(null)} />}
      </>
    )
  }

  return (
    <>
      <section aria-label="Resumo do orçamento" className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Orçado" value={formatBRL(limit)} icon={ClipboardList} tone="brand" hint={monthLabel(month)} />
        <StatCard
          label="Gasto"
          value={formatBRL(spent)}
          icon={ChartPie}
          hint={`${formatPercent(ratio(spent, limit))} do orçado`}
        />
        <StatCard
          label="Disponível"
          value={formatBRL(limit - spent)}
          icon={ChartPie}
          tone={limit - spent < 0 ? 'neg' : 'pos'}
          hint={
            alerts > 0
              ? `${alerts} ${alerts === 1 ? 'categoria em alerta' : 'categorias em alerta'}`
              : 'Tudo dentro do limite'
          }
        />
      </section>

      <Card>
        <CardHeader
          title="Limites"
          subtitle="Alerta a partir de 80% e destaque ao ultrapassar 100%"
          action={
            <Button variant="secondary" size="sm" icon={Plus} onClick={() => setForm({})}>
              Novo limite
            </Button>
          }
        />
        <div className="space-y-6">
          {statuses.map((s) => (
            <BudgetProgress
              key={s.budget.id}
              label={s.category?.name ?? 'Categoria removida'}
              icon={s.category?.icon}
              color={s.category?.color}
              spent={s.spent}
              limit={s.budget.limit_cents}
              onEdit={() => setForm({ editing: s.budget })}
              onDelete={() => setDeleting(s.budget)}
            />
          ))}
        </div>
      </Card>

      {form && <BudgetForm editing={form.editing} onClose={() => setForm(null)} />}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Excluir limite?"
        description="O limite desta categoria será removido. Os lançamentos não são alterados."
        onConfirm={async () => {
          if (deleting) await db.remove('budgets', deleting.id, 'Limite excluído')
        }}
      />
    </>
  )
}

function BudgetForm({ editing, onClose }: { editing?: BudgetRow; onClose: () => void }) {
  const { budgets } = useFinance()
  const db = useDb()
  const [categoryId, setCategoryId] = useState(editing?.category_id ?? null)
  const [limit, setLimit] = useState(editing?.limit_cents ?? 0)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!categoryId) return setError('Escolha a categoria.')
    if (limit <= 0) return setError('Informe um limite maior que zero.')
    if (budgets.some((b) => b.category_id === categoryId && b.id !== editing?.id)) {
      return setError('Esta categoria já tem um limite. Edite o existente.')
    }
    setSaving(true)
    const row = { category_id: categoryId, limit_cents: limit }
    const ok = editing
      ? await db.update('budgets', editing.id, row, 'Limite atualizado')
      : await db.create('budgets', row, 'Limite criado')
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={editing ? 'Editar limite' : 'Novo limite'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="budget-form" loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="budget-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Categoria" hint="Uma categoria principal inclui os gastos das subcategorias.">
          {(id) => (
            <CategorySelect id={id} type="expense" value={categoryId} onChange={setCategoryId} emptyLabel="Escolha…" />
          )}
        </Field>
        <Field label="Limite mensal" error={error ?? undefined}>
          {(id) => <MoneyInput id={id} value={limit} onChange={setLimit} />}
        </Field>
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Planejamento do mês                                                 */
/* ------------------------------------------------------------------ */

const PLAN_SERIES: ChartSeries[] = [
  { key: 'planned', label: 'Planejado', color: 'var(--series-neutral)' },
  { key: 'actual', label: 'Realizado', color: 'var(--series-savings)' },
]

function Plan() {
  const data = useFinance()
  const db = useDb()
  const { month } = useMonth()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const plan = data.plans.find((p) => p.month === month)

  const rows = useMemo(() => (plan ? planVersusActual(data, plan, todayISO()) : []), [data, plan])

  if (!plan) {
    return (
      <>
        <Card>
          <EmptyState
            icon={ClipboardList}
            title={`Sem planejamento para ${monthLabel(month).toLowerCase()}`}
            description="Distribua sua renda prevista entre as categorias antes de o mês começar e compare depois com o realizado."
            action={
              <Button icon={Plus} onClick={() => setEditing(true)}>
                Criar planejamento
              </Button>
            }
          />
        </Card>
        {editing && <PlanEditor onClose={() => setEditing(false)} />}
      </>
    )
  }

  const planned = sumBy(plan.allocations, (a) => a.amount_cents)
  const unallocated = plan.expected_income_cents - planned
  const tracked = rows.filter((r) => r.actual !== null)

  return (
    <>
      <section aria-label="Resumo do planejamento" className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Renda prevista" value={formatBRL(plan.expected_income_cents)} icon={ClipboardList} tone="brand" />
        <StatCard
          label="Distribuído"
          value={formatBRL(planned)}
          icon={ChartPie}
          hint={`${formatPercent(ratio(planned, plan.expected_income_cents))} da renda`}
        />
        <StatCard
          label={unallocated < 0 ? 'Acima da renda' : 'Sem destino'}
          value={formatBRL(Math.abs(unallocated))}
          icon={ChartPie}
          tone={unallocated < 0 ? 'neg' : 'neutral'}
          hint={unallocated < 0 ? 'O plano soma mais do que a renda prevista' : 'Ainda não distribuído'}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Planejado x Realizado" subtitle="Categorias do plano com gastos registrados" />
          {tracked.length === 0 ? (
            <EmptyState compact icon={ChartPie} title="Nenhuma linha do plano está ligada a uma categoria" />
          ) : (
            <FinancialChart
              horizontal
              height={Math.max(220, tracked.length * 52)}
              data={tracked.map((r) => ({ label: r.label, planned: r.planned, actual: r.actual }))}
              series={PLAN_SERIES}
              caption="Valor planejado e realizado por categoria"
            />
          )}
        </Card>

        <Card padded={false} className="lg:col-span-2">
          <CardHeader
            className="mb-0 p-5 pb-4 sm:p-6 sm:pb-4"
            title="Distribuição planejada"
            action={
              <div className="-mr-2 flex">
                <IconButton icon={Pencil} label="Editar planejamento" onClick={() => setEditing(true)} />
                <IconButton icon={Trash2} label="Excluir planejamento" tone="danger" onClick={() => setDeleting(true)} />
              </div>
            }
          />
          <ul className="divide-y divide-line border-t border-line">
            {rows.map((r) => {
              const diff = r.actual === null ? null : r.planned - r.actual
              return (
                <li key={r.key} className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{r.label}</p>
                    <p className="text-xs text-muted">
                      {r.actual === null ? 'Sem categoria vinculada' : `Realizado ${formatBRL(r.actual)}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tnum text-sm font-bold text-ink">{formatBRL(r.planned)}</p>
                    {diff !== null && (
                      <p className={cn('tnum text-xs font-semibold', diff < 0 ? 'text-neg' : 'text-pos')}>
                        {diff < 0 ? `${formatBRL(-diff)} acima` : `${formatBRL(diff)} de folga`}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>

      {editing && <PlanEditor plan={plan} onClose={() => setEditing(false)} />}
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Excluir planejamento?"
        description={`O planejamento de ${monthLabel(month).toLowerCase()} será removido.`}
        onConfirm={() => db.remove('monthly_plans', plan.id, 'Planejamento excluído')}
      />
    </>
  )
}

function PlanEditor({ plan, onClose }: { plan?: MonthlyPlan; onClose: () => void }) {
  const data = useFinance()
  const db = useDb()
  const { month } = useMonth()
  const index = categoryIndex(data.categories)

  // Plano novo parte do mais recente; sem nenhum, dos limites de orçamento.
  const [income, setIncome] = useState(() => {
    if (plan) return plan.expected_income_cents
    return expectedIncome(data) || data.plans.at(-1)?.expected_income_cents || 0
  })
  const [rows, setRows] = useState<PlanAllocation[]>(() => {
    if (plan) return plan.allocations
    const latest = [...data.plans].sort((a, b) => b.month.localeCompare(a.month))[0]
    if (latest) return latest.allocations.map((a) => ({ ...a, key: crypto.randomUUID() }))
    return data.budgets.map((b) => ({
      key: crypto.randomUUID(),
      label: index.byId.get(b.category_id)?.name ?? 'Categoria',
      category_id: b.category_id,
      amount_cents: b.limit_cents,
    }))
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const planned = sumBy(rows, (r) => r.amount_cents)
  const free = income - planned
  const patch = (key: string, change: Partial<PlanAllocation>) =>
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...change } : r)))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (income <= 0) return setError('Informe a renda prevista.')
    const clean = rows
      .filter((r) => r.amount_cents > 0)
      .map((r) => ({ ...r, label: r.label.trim() || index.byId.get(r.category_id ?? '')?.name || 'Sem nome' }))
    if (clean.length === 0) return setError('Adicione pelo menos uma linha com valor.')
    setSaving(true)
    const ok = plan
      ? await db.update('monthly_plans', plan.id, { expected_income_cents: income, allocations: clean }, 'Planejamento salvo')
      : await db.create('monthly_plans', { month, expected_income_cents: income, allocations: clean }, 'Planejamento criado')
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Planejamento de ${monthLabel(month).toLowerCase()}`}
      description="Distribua a renda prevista. Linhas com categoria são comparadas com o realizado."
      footer={
        <>
          <p className={cn('mr-auto text-sm font-semibold', free < 0 ? 'text-neg' : 'text-ink-2')}>
            {free < 0 ? `${formatBRL(-free)} acima da renda` : `Livre: ${formatBRL(free)}`}
          </p>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="plan-form" loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="plan-form" onSubmit={submit} className="space-y-5" noValidate>
        <Field label="Renda prevista" error={error ?? undefined}>
          {(id) => <MoneyInput id={id} value={income} onChange={setIncome} />}
        </Field>

        <div>
          <p className="mb-2 text-[13px] font-semibold text-ink-2">Distribuição</p>
          <ul className="space-y-3">
            {rows.map((row) => (
              <li
                key={row.key}
                className="grid grid-cols-[1fr_auto] gap-2 rounded-xl bg-surface-2 p-3 sm:grid-cols-[1fr_1fr_9rem_auto] sm:items-center sm:bg-transparent sm:p-0"
              >
                <Input
                  aria-label="Nome da linha"
                  placeholder="Ex.: Reserva"
                  value={row.label}
                  onChange={(e) => patch(row.key, { label: e.target.value })}
                  maxLength={40}
                />
                <IconButton
                  icon={Trash2}
                  label={`Remover linha ${row.label}`}
                  tone="danger"
                  className="sm:order-last"
                  onClick={() => setRows((list) => list.filter((r) => r.key !== row.key))}
                />
                <CategorySelect
                  aria-label="Categoria vinculada"
                  type="expense"
                  rootsOnly
                  value={row.category_id}
                  emptyLabel="Sem categoria"
                  onChange={(categoryId) =>
                    patch(row.key, {
                      category_id: categoryId,
                      label: row.label || index.byId.get(categoryId ?? '')?.name || '',
                    })
                  }
                  className="col-span-2 sm:col-span-1"
                />
                <div className="col-span-2 sm:col-span-1">
                  <MoneyInput
                    aria-label={`Valor de ${row.label || 'linha'}`}
                    value={row.amount_cents}
                    onChange={(v) => patch(row.key, { amount_cents: v })}
                  />
                </div>
              </li>
            ))}
          </ul>
          <Button
            variant="secondary"
            size="sm"
            icon={Plus}
            className="mt-3"
            onClick={() =>
              setRows((list) => [...list, { key: crypto.randomUUID(), label: '', category_id: null, amount_cents: 0 }])
            }
          >
            Adicionar linha
          </Button>
        </div>
      </form>
    </Modal>
  )
}
