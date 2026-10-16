import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean
}

export function Card({ padded = true, className, ...props }: CardProps) {
  return (
    <div
      className={cn('rounded-2xl border border-line bg-surface shadow-card', padded && 'p-5 sm:p-6', className)}
      {...props}
    />
  )
}

interface CardHeaderProps {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
  className?: string
}

export function CardHeader({ title, subtitle, action, className }: CardHeaderProps) {
  return (
    <div className={cn('mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-2', className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
