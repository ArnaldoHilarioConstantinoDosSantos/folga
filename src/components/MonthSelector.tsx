import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMonth } from '@/contexts/MonthContext'
import { cn } from '@/lib/cn'
import type { MonthKey } from '@/types'
import { addMonths, currentMonth, monthLabel } from '@/utils/date'

interface MonthSelectorProps {
  /** Sem `value`, controla o mês global compartilhado entre as telas. */
  value?: MonthKey
  onChange?: (month: MonthKey) => void
  className?: string
}

export function MonthSelector({ value, onChange, className }: MonthSelectorProps) {
  const shared = useMonth()
  const month = value ?? shared.month
  const set = onChange ?? shared.setMonth
  const isCurrent = month === currentMonth()

  const arrow =
    'flex size-9 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink'

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      <div className="inline-flex items-center rounded-xl border border-line bg-surface p-0.5 shadow-card">
        <button type="button" className={arrow} onClick={() => set(addMonths(month, -1))} aria-label="Mês anterior">
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-36 px-1 text-center text-sm font-bold text-ink" aria-live="polite">
          {monthLabel(month)}
        </span>
        <button type="button" className={arrow} onClick={() => set(addMonths(month, 1))} aria-label="Próximo mês">
          <ChevronRight className="size-4" />
        </button>
      </div>
      {!isCurrent && (
        <button
          type="button"
          onClick={() => set(currentMonth())}
          className="rounded-lg px-2.5 py-2 text-[13px] font-semibold text-brand transition-colors hover:bg-brand-soft"
        >
          Hoje
        </button>
      )}
    </div>
  )
}
