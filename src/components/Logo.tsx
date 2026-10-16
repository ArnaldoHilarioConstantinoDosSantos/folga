import { cn } from '@/lib/cn'

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="9" fill="var(--brand)" />
        <path
          d="M9 21.5c3.2 0 4.6-2.4 6-5.2 1.5-3 3.1-5.8 8-5.8"
          fill="none"
          stroke="var(--brand-ink)"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <circle cx="23" cy="10.5" r="2.4" fill="var(--brand-ink)" opacity="0.65" />
      </svg>
      {!compact && <span className="text-xl font-extrabold tracking-tight text-ink">Folga</span>}
    </span>
  )
}
