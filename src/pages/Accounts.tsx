import { useMemo, useState, type FormEvent } from 'react'
import { ArrowLeftRight, ArrowRight, Landmark, Pencil, Plus, Trash2, Wallet } from 'lucide-react'
import { CategoryIcon } from '@/components/CategoryIcon'
import { FinancialChart, type ChartSeries } from '@/components/charts/FinancialChart'
import { ColorPicker } from '@/components/ColorPicker'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Button, IconButton } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Segmented } from '@/components/ui/Feedback'
import { Field, Input, MoneyInput, Select } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { useFinance } from '@/contexts/FinanceContext'
import { useDb } from '@/hooks/useDb'
import { cn } from '@/lib/cn'
import type { Account, AccountType, ColorKey, Transfer } from '@/types'
import { currentMonth, formatDate, todayISO } from '@/utils/date'
import { accountBalances, netWorthAt, netWorthSeries } from '@/utils/finance'
import { ACCOUNT_TYPES, optionsOf } from '@/utils/labels'
import { formatBRL } from '@/utils/money'

const ACCOUNT_ICONS: Record<AccountType, string> = {
  checking: 'landmark',
  salary: 'briefcase',
  digital: 'smartphone',
  wallet: 'wallet',
  savings: 'piggy',
  investment: 'trending',
}

const WORTH_SERIES: ChartSeries[] = [
  { key: 'total', label: 'Patrimônio', color: 'var(--series-savings)', kind: 'area' },
]

type Range = '6' | '12'

export default function Accounts() {
  const data = useFinance()
  const db = useDb()
  const [form, setForm] = useState<{ editing?: Account } | null>(null)
  const [transferring, setTransferring] = useState(false)
  const [deleting, setDeleting] = useState<Account | null>(null)
  const [deletingTransfer, setDeletingTransfer] = useState<Transfer | null>(null)
  const [range, setRange] = useState<Range>('6')

  const balances = useMemo(() => accountBalances(data), [data])
  const worth = useMemo(() => netWorthAt(data), [data])
  const series = useMemo(
    () => netWorthSeries(data, currentMonth(), Number(range)).map((p) => ({ label: p.label, total: p.total })),
    [data, range],
  )
  const accountName = new Map(data.accounts.map((a) => [a.id, a.name]))
  const transfers = [...data.transfers].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)

  return (
    <>
      <PageHeader
        title="Contas e patrimônio"
        subtitle="Onde seu dinheiro está e como seu patrimônio evolui."
        actions={
          <>
            <Button
              variant="outline"
              icon={ArrowLeftRight}
              onClick={() => setTransferring(true)}
              disabled={data.accounts.length < 2}
            >
              Transferir
            </Button>
            <Button icon={Plus} onClick={() => setForm({})}>
              Nova conta
            </Button>
          </>
        }
      />

      <section aria-label="Patrimônio" className="mb-6 grid gap-4 lg:grid-cols-12">
        <StatCard
          hero
          className="lg:col-span-4"
          label="Patrimônio total"
          value={formatBRL(worth.total)}
          icon={Landmark}
          hint="Contas + investimentos + reserva + metas"
        />
        <div className="grid gap-4 sm:grid-cols-3 lg:col-span-8">
          <StatCard label="Saldo em contas" value={formatBRL(worth.accounts)} icon={Wallet} tone="brand" />
          <StatCard label="Investimentos" value={formatBRL(worth.investments)} icon={Landmark} tone="pos" />
          <StatCard
            label="Reserva de emergência"
            value={formatBRL(worth.reserve)}
            icon={Landmark}
            hint={worth.goals > 0 ? `+ ${formatBRL(worth.goals)} em outras metas` : undefined}
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card padded={false} className="lg:col-span-2">
          <CardHeader className="mb-0 p-5 pb-4 sm:p-6 sm:pb-4" title="Contas e carteiras" />
          {data.accounts.length === 0 ? (
            <EmptyState
              compact
              icon={Wallet}
              title="Nenhuma conta cadastrada"
              description="Cadastre conta corrente, carteira, conta digital ou investimentos."
              action={
                <Button size="sm" icon={Plus} onClick={() => setForm({})}>
                  Nova conta
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {data.accounts.map((account) => {
                const balance = balances.get(account.id) ?? 0
                return (
                  <li key={account.id} className="group flex items-center gap-3 px-5 py-3.5 sm:px-6">
                    <CategoryIcon icon={ACCOUNT_ICONS[account.type]} color={account.color} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{account.name}</p>
                      <p className="text-xs text-muted">{ACCOUNT_TYPES[account.type]}</p>
                    </div>
                    <span className={cn('tnum text-sm font-bold', balance < 0 ? 'text-neg' : 'text-ink')}>
                      {formatBRL(balance)}
                    </span>
                    <div className="flex md:opacity-0 md:transition-opacity md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                      <IconButton icon={Pencil} label={`Editar ${account.name}`} onClick={() => setForm({ editing: account })} />
                      <IconButton icon={Trash2} label={`Excluir ${account.name}`} tone="danger" onClick={() => setDeleting(account)} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader
            title="Evolução do patrimônio"
            subtitle="Posição no fim de cada mês"
            action={
              <Segmented
                label="Período"
                size="sm"
                value={range}
                onChange={setRange}
                options={[
                  { value: '6', label: '6 meses' },
                  { value: '12', label: '12 meses' },
                ]}
              />
            }
          />
          <FinancialChart data={series} series={WORTH_SERIES} height={260} caption="Evolução do patrimônio por mês" />
        </Card>
      </div>

      <Card padded={false} className="mt-4">
        <CardHeader
          className="mb-0 p-5 pb-4 sm:p-6 sm:pb-4"
          title="Transferências recentes"
          subtitle="Movem dinheiro entre contas sem contar como receita ou despesa"
        />
        {transfers.length === 0 ? (
          <EmptyState compact icon={ArrowLeftRight} title="Nenhuma transferência registrada" />
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {transfers.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                <span className="tnum w-20 shrink-0 text-xs font-semibold text-muted">{formatDate(t.date)}</span>
                <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 text-sm font-semibold text-ink">
                  <span className="truncate">{accountName.get(t.from_account_id) ?? 'Conta removida'}</span>
                  <ArrowRight className="size-3.5 shrink-0 text-muted" aria-label="para" />
                  <span className="truncate">{accountName.get(t.to_account_id) ?? 'Conta removida'}</span>
                  {t.note && <span className="truncate text-xs font-normal text-muted">· {t.note}</span>}
                </p>
                <span className="tnum text-sm font-bold text-ink">{formatBRL(t.amount_cents)}</span>
                <IconButton icon={Trash2} label="Excluir transferência" tone="danger" onClick={() => setDeletingTransfer(t)} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {form && <AccountForm editing={form.editing} onClose={() => setForm(null)} />}
      {transferring && <TransferForm onClose={() => setTransferring(false)} />}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Excluir conta?"
        description={`A conta "${deleting?.name ?? ''}" e suas transferências serão removidas. Os lançamentos são mantidos, sem conta vinculada.`}
        onConfirm={async () => {
          if (deleting) await db.remove('accounts', deleting.id, 'Conta excluída')
        }}
      />
      <ConfirmDialog
        open={deletingTransfer !== null}
        onClose={() => setDeletingTransfer(null)}
        title="Excluir transferência?"
        description="Os saldos das duas contas voltam ao valor anterior."
        onConfirm={async () => {
          if (deletingTransfer) await db.remove('transfers', deletingTransfer.id, 'Transferência excluída')
        }}
      />
    </>
  )
}

function AccountForm({ editing, onClose }: { editing?: Account; onClose: () => void }) {
  const db = useDb()
  const [name, setName] = useState(editing?.name ?? '')
  const [type, setType] = useState<AccountType>(editing?.type ?? 'checking')
  const [balance, setBalance] = useState(editing?.initial_balance_cents ?? 0)
  const [color, setColor] = useState<ColorKey>(editing?.color ?? 'blue')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return setError('Informe o nome da conta.')
    const row = { name: name.trim(), type, initial_balance_cents: balance, color }
    setSaving(true)
    const ok = editing
      ? await db.update('accounts', editing.id, row, 'Conta atualizada')
      : await db.create('accounts', row, 'Conta criada')
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Editar conta' : 'Nova conta'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="account-form" loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="account-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nome" error={error ?? undefined}>
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Conta corrente" maxLength={60} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo">
            {(id) => (
              <Select id={id} value={type} onChange={(e) => setType(e.target.value as AccountType)}>
                {optionsOf(ACCOUNT_TYPES).map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Saldo inicial" hint="Quanto havia na conta antes dos lançamentos.">
            {(id) => <MoneyInput id={id} value={balance} onChange={setBalance} />}
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

function TransferForm({ onClose }: { onClose: () => void }) {
  const { accounts } = useFinance()
  const db = useDb()
  const [from, setFrom] = useState(accounts[0]?.id ?? '')
  const [to, setTo] = useState(accounts[1]?.id ?? '')
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!from || !to) return setError('Escolha as duas contas.')
    if (from === to) return setError('Origem e destino precisam ser contas diferentes.')
    if (amount <= 0) return setError('Informe um valor maior que zero.')
    if (!date) return setError('Informe a data.')
    setSaving(true)
    const ok = await db.create(
      'transfers',
      { from_account_id: from, to_account_id: to, amount_cents: amount, date, note: note.trim() || null },
      'Transferência registrada',
    )
    setSaving(false)
    if (ok) onClose()
  }

  const options = accounts.map((a) => (
    <option key={a.id} value={a.id}>
      {a.name}
    </option>
  ))

  return (
    <Modal
      open
      onClose={onClose}
      title="Transferir entre contas"
      description="Não conta como receita nem como despesa."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="transfer-form" loading={saving}>
            Transferir
          </Button>
        </>
      }
    >
      <form id="transfer-form" onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="De">
            {(id) => (
              <Select id={id} value={from} onChange={(e) => setFrom(e.target.value)}>
                {options}
              </Select>
            )}
          </Field>
          <Field label="Para">
            {(id) => (
              <Select id={id} value={to} onChange={(e) => setTo(e.target.value)}>
                {options}
              </Select>
            )}
          </Field>
          <Field label="Valor" error={error ?? undefined}>
            {(id) => <MoneyInput id={id} value={amount} onChange={setAmount} />}
          </Field>
          <Field label="Data">
            {(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
        </div>
        <Field label="Observação">
          {(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" maxLength={120} />}
        </Field>
      </form>
    </Modal>
  )
}
