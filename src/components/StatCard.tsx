import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Card } from './ui/Card'

type Tone = 'neutral' | 'pos' | 'neg' | 'warn' | 'brand'

const ICON_TONE: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink-2',
  pos: 'bg-pos-soft text-pos',
  neg: 'bg-neg-soft text-neg',
  warn: 'bg-warn-soft text-warn',
  brand: 'bg-brand-soft text-brand',
}

interface StatCardProps {
  label: string
  value: string
  icon: LucideIcon
  tone?: Tone
  /** Linha de apoio sob o valor (ex.: "18% da sua renda"). */
  hint?: ReactNode
  /** Versão de destaque, com fundo escuro — uma por tela. */
  hero?: boolean
  className?: string
}

export function StatCard({ label, value, icon: Icon, tone = 'neutral', hint, hero = false, className }: StatCardProps) {
  if (hero) {
    return (
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl bg-hero p-6 text-hero-ink shadow-card',
          className,
        )}
      >
        <div
          className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-white/[0.06]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-20 -bottom-24 size-56 rounded-full bg-white/[0.04]"
          aria-hidden
        />
        <div className="relative flex h-full flex-col justify-between gap-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold opacity-80">{label}</span>
            <span className="flex size-9 items-center justify-center rounded-xl bg-white/10">
              <Icon className="size-[18px]" aria-hidden />
            </span>
          </div>
          <div>
            <p className="text-4xl font-extrabold tracking-tight sm:text-[2.75rem] sm:leading-none">{value}</p>
            {hint && <div className="mt-3 text-[13px] font-medium opacity-80">{hint}</div>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold text-ink-2">{label}</span>
        <span className={cn('flex size-8 items-center justify-center rounded-lg', ICON_TONE[tone])}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <div>
        <p className="text-2xl font-extrabold tracking-tight text-ink">{value}</p>
        {hint && <div className="mt-1 text-[13px] text-muted">{hint}</div>}
      </div>
    </Card>
  )
}
