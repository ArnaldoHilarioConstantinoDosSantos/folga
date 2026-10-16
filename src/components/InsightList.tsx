import { CircleCheck, Lightbulb, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { Insight, Tone } from '@/utils/insights'

const TONES: Record<Tone, { icon: typeof Lightbulb; className: string }> = {
  good: { icon: CircleCheck, className: 'bg-pos-soft text-pos' },
  bad: { icon: TriangleAlert, className: 'bg-warn-soft text-warn' },
  neutral: { icon: Lightbulb, className: 'bg-brand-soft text-brand' },
}

export function InsightList({ items, className }: { items: Insight[]; className?: string }) {
  return (
    <ul className={cn('space-y-3', className)}>
      {items.map((item) => {
        const { icon: Icon, className: tone } = TONES[item.tone]
        return (
          <li key={item.id} className="flex items-start gap-3">
            <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg', tone)}>
              <Icon className="size-3.5" aria-hidden />
            </span>
            <p className="text-[13px] leading-relaxed font-medium text-ink-2">{item.text}</p>
          </li>
        )
      })}
    </ul>
  )
}
