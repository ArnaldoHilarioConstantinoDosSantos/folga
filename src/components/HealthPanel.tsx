import { CircleAlert, CircleCheck, CircleMinus, TriangleAlert, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { HealthIndicator, HealthStatus } from '@/utils/finance'
import { ProgressBar, type Tone } from './ui/Feedback'

const STATUS: Record<HealthStatus, { label: string; icon: LucideIcon; text: string; bar: Tone }> = {
  good: { label: 'Saudável', icon: CircleCheck, text: 'text-pos', bar: 'pos' },
  attention: { label: 'Atenção', icon: TriangleAlert, text: 'text-warn', bar: 'warn' },
  critical: { label: 'Crítico', icon: CircleAlert, text: 'text-neg', bar: 'neg' },
  neutral: { label: 'Sem dados', icon: CircleMinus, text: 'text-muted', bar: 'neutral' },
}

/**
 * Saúde financeira como uma lista de indicadores objetivos — cada um com seu
 * valor, uma leitura em texto e o estado (ícone + rótulo, nunca só a cor).
 */
export function HealthPanel({ indicators, columns = false }: { indicators: HealthIndicator[]; columns?: boolean }) {
  return (
    <ul className={cn(columns ? 'grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-5')}>
      {indicators.map((item) => {
        const status = STATUS[item.status]
        const Icon = status.icon
        return (
          <li key={item.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-semibold text-ink-2">{item.label}</span>
              <span className={cn('flex shrink-0 items-center gap-1 text-xs font-bold', status.text)}>
                <Icon className="size-3.5" aria-hidden />
                {status.label}
              </span>
            </div>
            <p className="mt-0.5 text-lg font-extrabold tracking-tight text-ink">{item.value}</p>
            {item.fill !== null && (
              <div className="mt-1.5">
                <ProgressBar value={item.fill} tone={status.bar} size="sm" label={`${item.label}: ${item.value}`} />
              </div>
            )}
            <p className="mt-1.5 text-xs text-muted">{item.detail}</p>
          </li>
        )
      })}
    </ul>
  )
}
