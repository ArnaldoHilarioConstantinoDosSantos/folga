import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type Tone = 'neutral' | 'brand' | 'pos' | 'neg' | 'warn'

const BADGE: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink-2',
  brand: 'bg-brand-soft text-brand',
  pos: 'bg-pos-soft text-pos',
  neg: 'bg-neg-soft text-neg',
  warn: 'bg-warn-soft text-warn',
}

export function Badge({ tone = 'neutral', className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        BADGE[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

const BAR: Record<Tone, string> = {
  neutral: 'bg-muted',
  brand: 'bg-brand',
  pos: 'bg-[var(--status-good)]',
  neg: 'bg-[var(--status-critical)]',
  warn: 'bg-[var(--status-warning)]',
}

interface ProgressBarProps {
  /** Razão de 0 a 1; valores acima de 1 preenchem a barra inteira. */
  value: number
  tone?: Tone
  /** Cor CSS própria (ex.: cor da categoria); tem prioridade sobre `tone`. */
  color?: string
  label: string
  size?: 'sm' | 'md'
}

export function ProgressBar({ value, tone = 'brand', color, label, size = 'md' }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) * 100
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn('w-full overflow-hidden rounded-full bg-surface-2', size === 'sm' ? 'h-1.5' : 'h-2')}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500 ease-out', !color && BAR[tone])}
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-surface-2', className)} />
}

interface SegmentedProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; label: string }>
  label: string
  size?: 'sm' | 'md'
  className?: string
}

export function Segmented<T extends string>({ value, onChange, options, label, size = 'md', className }: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('inline-flex rounded-xl bg-surface-2 p-1', className)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex-1 rounded-lg font-semibold whitespace-nowrap transition-all',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-[13px]',
            option.value === value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
