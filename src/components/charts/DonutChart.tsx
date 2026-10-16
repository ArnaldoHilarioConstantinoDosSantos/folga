import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { Slice } from '@/utils/finance'
import { formatBRL, formatPercent } from '@/utils/money'
import { TooltipCard, TooltipRow } from './FinancialChart'

interface DonutChartProps {
  slices: Slice[]
  centerLabel: string
  centerValue: string
  caption: string
}

interface TipProps {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: unknown }>
}

/** Rosca com o total no centro e a legenda ao lado, com valor e percentual. */
export function DonutChart({ slices, centerLabel, centerValue, caption }: DonutChartProps) {
  const tooltip = ({ active, payload }: TipProps) => {
    const slice = payload?.[0]?.payload as Slice | undefined
    if (!active || !slice) return null
    return (
      <TooltipCard title={slice.label}>
        <TooltipRow color={slice.color} label="Valor" value={formatBRL(slice.value)} />
        <TooltipRow color={slice.color} label="Da renda" value={formatPercent(slice.share, 1)} />
      </TooltipCard>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row lg:flex-col">
      <div className="relative size-44 shrink-0" role="img" aria-label={caption}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              innerRadius="70%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              paddingAngle={slices.length > 1 ? 2 : 0}
              cornerRadius={3}
              stroke="none"
              animationDuration={500}
            >
              {slices.map((slice) => (
                <Cell key={slice.key} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip content={tooltip} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs font-medium text-muted">{centerLabel}</span>
          <span className="text-base font-extrabold text-ink">{centerValue}</span>
        </div>
      </div>

      <ul className="w-full min-w-0 flex-1 space-y-2">
        {slices.map((slice) => (
          <li key={slice.key} className="flex items-center gap-2.5 text-[13px]">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: slice.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate font-medium text-ink-2">{slice.label}</span>
            <span className="tnum text-muted">{formatBRL(slice.value)}</span>
            <span className="tnum w-11 text-right font-bold text-ink">{formatPercent(slice.share)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
