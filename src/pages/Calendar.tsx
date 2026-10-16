import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Check, ChevronRight } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { MonthSelector } from '@/components/MonthSelector'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/Card'
import { useFinance } from '@/contexts/FinanceContext'
import { useMonth } from '@/contexts/MonthContext'
import { useDb } from '@/hooks/useDb'
import { cn } from '@/lib/cn'
import type { ISODate } from '@/types'
import {
  WEEKDAYS,
  WEEKDAYS_SHORT,
  dateInMonth,
  dayOf,
  daysInMonth,
  formatDate,
  monthOf,
  parseISO,
  startOfMonth,
  todayISO,
} from '@/utils/date'
import { calendarItems, type CalendarItem, type CalendarKind } from '@/utils/finance'
import { formatBRL, sumBy } from '@/utils/money'

const KINDS: Record<CalendarKind, { label: string; color: string }> = {
  income: { label: 'Receita', color: 'var(--series-income)' },
  fixed: { label: 'Gasto fixo', color: 'var(--cat-blue)' },
  installment: { label: 'Parcela', color: 'var(--cat-violet)' },
  invoice: { label: 'Fatura de cartão', color: 'var(--cat-orange)' },
  expense: { label: 'Conta', color: 'var(--cat-gray)' },
}

export default function CalendarPage() {
  const data = useFinance()
  const db = useDb()
  const { month } = useMonth()
  const today = todayISO()
  const [picked, setPicked] = useState<ISODate | null>(null)

  const items = useMemo(() => calendarItems(data, month, today), [data, month, today])
  const byDay = useMemo(() => {
    const map = new Map<number, CalendarItem[]>()
    for (const item of items) {
      const day = dayOf(item.date)
      map.set(day, [...(map.get(day) ?? []), item])
    }
    return map
  }, [items])

  // Dia em foco: o escolhido (se for deste mês), hoje, ou o primeiro com algo.
  const selected =
    picked && monthOf(picked) === month
      ? picked
      : monthOf(today) === month
        ? today
        : (items[0]?.date ?? startOfMonth(month))
  const selectedItems = byDay.get(dayOf(selected)) ?? []

  const blanks = parseISO(startOfMonth(month)).getDay()
  const days = Array.from({ length: daysInMonth(month) }, (_, i) => i + 1)
  const open = items.filter((i) => !i.done)

  const togglePaid = (item: CalendarItem) => {
    const t = item.transaction
    if (t) void db.update('transactions', t.id, { paid: !t.paid }, t.paid ? 'Marcado como pendente' : 'Marcado como pago')
  }

  return (
    <>
      <PageHeader
        title="Calendário financeiro"
        subtitle="Vencimentos, faturas, parcelas e receitas previstas de cada dia."
        actions={<MonthSelector />}
      />

      <div className="mb-4 flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
        <span className="text-muted">
          A pagar{' '}
          <span className="tnum font-bold text-ink">
            {formatBRL(sumBy(open.filter((i) => i.kind !== 'income'), (i) => i.amount))}
          </span>
        </span>
        <span className="text-muted">
          A receber{' '}
          <span className="tnum font-bold text-pos">
            {formatBRL(sumBy(open.filter((i) => i.kind === 'income'), (i) => i.amount))}
          </span>
        </span>
        <ul className="ml-auto flex flex-wrap gap-x-4 gap-y-1">
          {Object.entries(KINDS).map(([kind, { label, color }]) => (
            <li key={kind} className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
              <span className="size-2 rounded-full" style={{ background: color }} aria-hidden />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <Card padded={false} className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line bg-surface-2/50">
            {WEEKDAYS_SHORT.map((name) => (
              <div key={name} className="py-2 text-center text-[11px] font-bold tracking-wide text-muted uppercase">
                {name}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: blanks }, (_, i) => (
              <div key={`blank-${i}`} className="border-r border-b border-line bg-surface-2/30" />
            ))}
            {days.map((day) => {
              const date = dateInMonth(month, day)
              const list = byDay.get(day) ?? []
              const isToday = date === today
              const isSelected = date === selected
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setPicked(date)}
                  aria-pressed={isSelected}
                  aria-label={`${formatDate(date)}: ${list.length} ${list.length === 1 ? 'item' : 'itens'}`}
                  className={cn(
                    'flex min-h-16 flex-col gap-1 border-r border-b border-line p-1.5 text-left transition-colors hover:bg-surface-2 sm:min-h-24 sm:p-2 [&:nth-child(7n)]:border-r-0',
                    isSelected && 'bg-brand-soft/60 hover:bg-brand-soft/60',
                  )}
                >
                  <span
                    className={cn(
                      'tnum flex size-6 items-center justify-center rounded-full text-xs font-bold',
                      isToday ? 'bg-brand text-brand-ink' : 'text-ink-2',
                    )}
                  >
                    {day}
                  </span>
                  {/* Celular: só os pontos. Telas maiores: os dois primeiros itens. */}
                  <span className="flex flex-wrap gap-1 sm:hidden">
                    {list.slice(0, 4).map((item) => (
                      <span
                        key={item.id}
                        className={cn('size-1.5 rounded-full', item.done && 'opacity-40')}
                        style={{ background: KINDS[item.kind].color }}
                      />
                    ))}
                  </span>
                  <span className="hidden w-full flex-col gap-0.5 sm:flex">
                    {list.slice(0, 2).map((item) => (
                      <span
                        key={item.id}
                        className={cn('flex items-center gap-1 text-[11px] leading-tight', item.done && 'opacity-50')}
                      >
                        <span
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ background: KINDS[item.kind].color }}
                        />
                        <span className={cn('truncate font-medium text-ink-2', item.done && 'line-through')}>
                          {item.label}
                        </span>
                      </span>
                    ))}
                    {list.length > 2 && (
                      <span className="text-[11px] font-semibold text-muted">+{list.length - 2}</span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </Card>

        <Card padded={false} className="h-fit">
          <div className="border-b border-line p-5">
            <p className="text-[15px] font-bold text-ink">{formatDate(selected)}</p>
            <p className="text-[13px] text-muted">{WEEKDAYS[parseISO(selected).getDay()]}</p>
          </div>
          {selectedItems.length === 0 ? (
            <EmptyState compact icon={CalendarDays} title="Nada neste dia" />
          ) : (
            <ul className="divide-y divide-line">
              {selectedItems.map((item) => {
                const kind = KINDS[item.kind]
                return (
                  <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: kind.color }} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className={cn('truncate text-sm font-semibold text-ink', item.done && 'text-muted line-through')}>
                        {item.label}
                      </p>
                      <p className="text-xs text-muted">
                        {kind.label} · {item.done ? (item.kind === 'income' ? 'Recebido' : 'Pago') : item.date < today ? 'Atrasado' : 'Previsto'}
                      </p>
                    </div>
                    <span className={cn('tnum text-sm font-bold', item.kind === 'income' ? 'text-pos' : 'text-ink')}>
                      {formatBRL(item.amount)}
                    </span>
                    {item.transaction ? (
                      <button
                        type="button"
                        onClick={() => togglePaid(item)}
                        aria-pressed={item.done}
                        aria-label={item.done ? 'Marcar como pendente' : 'Marcar como pago'}
                        className={cn(
                          'flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors',
                          item.done
                            ? 'border-transparent bg-pos-soft text-pos'
                            : 'border-line text-transparent hover:border-pos hover:text-pos',
                        )}
                      >
                        <Check className="size-3.5" strokeWidth={3} aria-hidden />
                      </button>
                    ) : item.cardId ? (
                      <Link
                        to={`/cartoes/${item.cardId}`}
                        aria-label="Abrir fatura"
                        className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
                      >
                        <ChevronRight className="size-4" aria-hidden />
                      </Link>
                    ) : (
                      <span className="size-7 shrink-0" />
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {selectedItems.length > 0 && (
            <p className="flex justify-between border-t border-line px-5 py-3 text-[13px] text-muted">
              Saídas do dia
              <span className="tnum font-bold text-ink">
                {formatBRL(sumBy(selectedItems.filter((i) => i.kind !== 'income'), (i) => i.amount))}
              </span>
            </p>
          )}
        </Card>
      </div>
    </>
  )
}
