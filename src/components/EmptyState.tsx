import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  compact?: boolean
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, compact = false, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center text-center', compact ? 'gap-2 py-6' : 'gap-3 py-12', className)}>
      <span
        className={cn(
          'flex items-center justify-center rounded-2xl bg-surface-2 text-muted',
          compact ? 'size-10' : 'size-14',
        )}
      >
        <Icon className={compact ? 'size-5' : 'size-6'} aria-hidden />
      </span>
      <div>
        <p className={cn('font-bold text-ink', compact ? 'text-sm' : 'text-base')}>{title}</p>
        {description && <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
