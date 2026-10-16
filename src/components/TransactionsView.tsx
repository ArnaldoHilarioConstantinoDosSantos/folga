import { useMemo, useState, type ReactNode } from 'react'
import { ListFilter, Plus, Receipt, Search, X } from 'lucide-react'
import { useFinance } from '@/contexts/FinanceContext'
import { useMonth } from '@/contexts/MonthContext'
import { useTransactionModal } from '@/contexts/TransactionModalContext'
import type { PaymentMethod, TxType } from '@/types'
import { currentMonth, yearOf } from '@/utils/date'
import { categoryIndex } from '@/utils/finance'
import { PAYMENT_METHODS, optionsOf } from '@/utils/labels'
import { formatBRL, sumBy } from '@/utils/money'
import { CategorySelect } from './CategorySelect'
import { EmptyState } from './EmptyState'
import { MonthSelector } from './MonthSelector'
import { PageHeader } from './PageHeader'
import { TransactionTable } from './TransactionTable'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { Segmented } from './ui/Feedback'
import { Input, Select } from './ui/Form'

type Period = 'month' | 'year' | 'all'
type Status = 'all' | 'paid' | 'pending'

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: 'month', label: 'Mês' },
  { value: 'year', label: 'Ano' },
  { value: 'all', label: 'Tudo' },
]

interface TransactionsViewProps {
  title: string
  subtitle: string
  /** Fixa o tipo (telas de Receitas e Despesas) e esconde esse filtro. */
  fixedType?: TxType
  /** Conteúdo extra entre o cabeçalho e os filtros. */
  children?: ReactNode
}

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** Listagem de lançamentos com busca e filtros — base de três telas. */
export function TransactionsView({ title, subtitle, fixedType, children }: TransactionsViewProps) {
  const { transactions, categories } = useFinance()
  const { month } = useMonth()
  const modal = useTransactionModal()

  const [period, setPeriod] = useState<Period>('month')
  const [year, setYear] = useState(() => yearOf(currentMonth()))
  const [type, setType] = useState<TxType | ''>('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [method, setMethod] = useState<PaymentMethod | ''>('')
  const [status, setStatus] = useState<Status>('all')
  const [search, setSearch] = useState('')

  const years = useMemo(() => {
    const set = new Set(transactions.map((t) => yearOf(t.date)))
    set.add(yearOf(currentMonth()))
    return [...set].sort((a, b) => b - a)
  }, [transactions])

  const effectiveType = fixedType ?? type
  const filtered = useMemo(() => {
    const index = categoryIndex(categories)
    const term = normalize(search.trim())
    return transactions.filter((t) => {
      if (period === 'month' && !t.date.startsWith(month)) return false
      if (period === 'year' && yearOf(t.date) !== year) return false
      if (effectiveType && t.type !== effectiveType) return false
      if (categoryId && t.category_id !== categoryId && index.rootOf(t.category_id)?.id !== categoryId) return false
      if (method && t.payment_method !== method) return false
      if (status === 'paid' && !t.paid) return false
      if (status === 'pending' && t.paid) return false
      if (term) {
        const haystack = normalize(`${t.description} ${t.notes ?? ''} ${index.pathOf(t.category_id)}`)
        if (!haystack.includes(term)) return false
      }
      return true
    })
  }, [transactions, categories, period, month, year, effectiveType, categoryId, method, status, search])

  const income = sumBy(filtered.filter((t) => t.type === 'income'), (t) => t.amount_cents)
  const expense = sumBy(filtered.filter((t) => t.type === 'expense'), (t) => t.amount_cents)
  const hasFilters = Boolean(type || categoryId || method || status !== 'all' || search)

  const clear = () => {
    setType('')
    setCategoryId(null)
    setMethod('')
    setStatus('all')
    setSearch('')
  }

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        // Sem tipo fixo, o botão global "Novo lançamento" já cumpre esse papel.
        actions={
          fixedType && (
            <Button icon={Plus} onClick={() => modal.create({ type: fixedType })}>
              {fixedType === 'income' ? 'Nova receita' : 'Nova despesa'}
            </Button>
          )
        }
      />

      {children}

      <Card padded={false}>
        <div className="space-y-3 border-b border-line p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <Segmented label="Período" value={period} onChange={setPeriod} options={PERIODS} />
            {period === 'month' && <MonthSelector />}
            {period === 'year' && (
              <Select
                aria-label="Ano"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-28"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            )}
            <div className="relative min-w-52 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input
                type="search"
                aria-label="Pesquisar lançamentos"
                placeholder="Pesquisar por descrição, observação ou categoria"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {!fixedType && (
              <Select aria-label="Tipo" value={type} onChange={(e) => setType(e.target.value as TxType | '')}>
                <option value="">Todos os tipos</option>
                <option value="income">Receitas</option>
                <option value="expense">Despesas</option>
              </Select>
            )}
            <CategorySelect
              aria-label="Categoria"
              value={categoryId}
              onChange={setCategoryId}
              type={effectiveType || undefined}
              emptyLabel="Todas as categorias"
            />
            <Select
              aria-label="Forma de pagamento"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod | '')}
            >
              <option value="">Todas as formas</option>
              {optionsOf(PAYMENT_METHODS).map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
            <Select aria-label="Situação" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
              <option value="all">Pagos e pendentes</option>
              <option value="paid">Pagos</option>
              <option value="pending">Pendentes</option>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[13px]">
            <span className="flex items-center gap-1.5 text-muted">
              <ListFilter className="size-3.5" aria-hidden />
              {filtered.length} {filtered.length === 1 ? 'lançamento' : 'lançamentos'}
            </span>
            {effectiveType !== 'expense' && (
              <span className="text-muted">
                Receitas <span className="tnum font-bold text-pos">{formatBRL(income)}</span>
              </span>
            )}
            {effectiveType !== 'income' && (
              <span className="text-muted">
                Despesas <span className="tnum font-bold text-ink">{formatBRL(expense)}</span>
              </span>
            )}
            {!effectiveType && (
              <span className="text-muted">
                Saldo <span className="tnum font-bold text-ink">{formatBRL(income - expense)}</span>
              </span>
            )}
            {hasFilters && (
              <button
                type="button"
                onClick={clear}
                className="ml-auto flex items-center gap-1 font-semibold text-brand hover:underline"
              >
                <X className="size-3.5" aria-hidden />
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        <TransactionTable
          transactions={filtered}
          empty={
            <EmptyState
              icon={hasFilters ? Search : Receipt}
              title={hasFilters ? 'Nenhum lançamento encontrado' : 'Nenhum lançamento neste período'}
              description={
                hasFilters
                  ? 'Tente ajustar ou limpar os filtros.'
                  : 'Registre uma receita ou despesa para começar a acompanhar.'
              }
              action={
                hasFilters ? (
                  <Button variant="secondary" onClick={clear}>
                    Limpar filtros
                  </Button>
                ) : (
                  <Button icon={Plus} onClick={() => modal.create({ type: fixedType ?? 'expense' })}>
                    Adicionar
                  </Button>
                )
              }
            />
          }
        />
      </Card>
    </>
  )
}
