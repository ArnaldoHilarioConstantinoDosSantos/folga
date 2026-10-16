import type { ReactNode } from 'react'
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatBRL } from '@/utils/money'

export interface ChartSeries {
  key: string
  label: string
  /** Cor CSS — normalmente uma variável (`var(--series-income)`). */
  color: string
  kind?: 'bar' | 'line' | 'area'
}

export type ChartRow = { label: string } & Record<string, number | string | null>

interface FinancialChartProps {
  data: ChartRow[]
  series: ChartSeries[]
  /** Descreve o gráfico para leitores de tela e intitula a tabela alternativa. */
  caption: string
  height?: number
  /** Barras deitadas, com os rótulos no eixo vertical (bom para categorias). */
  horizontal?: boolean
  /** Empilha as barras (partes de um total). */
  stacked?: boolean
}

interface TipProps {
  active?: boolean
  label?: unknown
  payload?: ReadonlyArray<{ dataKey?: unknown; value?: unknown }>
}

export function TooltipCard({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-40 rounded-xl border border-line bg-surface px-3 py-2.5 shadow-pop">
      {title && <p className="mb-1.5 text-xs font-bold text-ink">{title}</p>}
      <div className="space-y-1">{children}</div>
    </div>
  )
}

export function TooltipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs">
      <span className="flex items-center gap-1.5 text-ink-2">
        <span className="size-2 rounded-full" style={{ background: color }} aria-hidden />
        {label}
      </span>
      <span className="tnum font-bold text-ink">{value}</span>
    </div>
  )
}

export function ChartLegend({ items }: { items: Array<{ label: string; color: string; line?: boolean }> }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
          <span
            className={item.line ? 'h-0.5 w-3.5 rounded-full' : 'size-2.5 rounded-[3px]'}
            style={{ background: item.color }}
            aria-hidden
          />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

const AXIS_TICK = { fontSize: 12, fill: 'var(--chart-axis)' }
const compact = (cents: number) => formatBRL(cents, { compact: true })

/**
 * Gráfico de séries em reais (valores em centavos): barras, linhas e áreas
 * sobre um único eixo. Sempre acompanha legenda (2+ séries), tooltip e uma
 * tabela equivalente para leitores de tela.
 */
export function FinancialChart({
  data,
  series,
  caption,
  height = 280,
  horizontal = false,
  stacked = false,
}: FinancialChartProps) {
  const hasNegative = data.some((row) => series.some((s) => Number(row[s.key] ?? 0) < 0))
  const hasValues = data.some((row) => series.some((s) => Number(row[s.key] ?? 0) !== 0))

  // Tudo zerado: um eixo só com "R$ 0" não informa nada.
  if (!hasValues) {
    return (
      <div
        style={{ height }}
        className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line text-center"
      >
        <p className="text-sm font-bold text-ink">Ainda sem dados para o gráfico</p>
        <p className="text-[13px] text-muted">Ele aparece assim que houver valores neste período.</p>
      </div>
    )
  }

  const tooltip = ({ active, label, payload }: TipProps) => {
    if (!active || !payload?.length) return null
    return (
      <TooltipCard title={String(label ?? '')}>
        {series.map((s) => {
          const item = payload.find((p) => p.dataKey === s.key)
          if (!item || item.value === null || item.value === undefined) return null
          return <TooltipRow key={s.key} color={s.color} label={s.label} value={formatBRL(Number(item.value))} />
        })}
      </TooltipCard>
    )
  }

  const valueAxis = {
    type: 'number' as const,
    tickFormatter: compact,
    tick: AXIS_TICK,
    axisLine: false,
    tickLine: false,
  }
  const categoryAxis = {
    type: 'category' as const,
    dataKey: 'label',
    tick: AXIS_TICK,
    axisLine: false,
    tickLine: false,
  }

  return (
    <figure className="m-0">
      {series.length > 1 && (
        <div className="mb-4">
          <ChartLegend items={series.map((s) => ({ label: s.label, color: s.color, line: s.kind === 'line' }))} />
        </div>
      )}
      <div style={{ height }} role="img" aria-label={caption}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            layout={horizontal ? 'vertical' : 'horizontal'}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            barGap={2}
            barCategoryGap={horizontal ? '28%' : '24%'}
          >
            <CartesianGrid stroke="var(--chart-grid)" vertical={horizontal} horizontal={!horizontal} />
            {horizontal ? (
              <>
                <XAxis {...valueAxis} />
                <YAxis {...categoryAxis} width={104} />
              </>
            ) : (
              <>
                <XAxis {...categoryAxis} tickMargin={8} />
                <YAxis {...valueAxis} width={68} />
              </>
            )}
            {hasNegative &&
              (horizontal ? (
                <ReferenceLine x={0} stroke="var(--chart-axis)" />
              ) : (
                <ReferenceLine y={0} stroke="var(--chart-axis)" />
              ))}
            <Tooltip content={tooltip} cursor={{ fill: 'var(--surface-2)', stroke: 'var(--line)' }} />
            {series.map((s) => {
              if (s.kind === 'line') {
                return (
                  <Line
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    stroke={s.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    dot={{ r: 4, fill: s.color, stroke: 'var(--surface)', strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: s.color, stroke: 'var(--surface)', strokeWidth: 2 }}
                    animationDuration={500}
                  />
                )
              }
              if (s.kind === 'area') {
                return (
                  <Area
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    stroke={s.color}
                    strokeWidth={2}
                    fill={s.color}
                    fillOpacity={0.1}
                    activeDot={{ r: 5, fill: s.color, stroke: 'var(--surface)', strokeWidth: 2 }}
                    animationDuration={500}
                  />
                )
              }
              return (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  fill={s.color}
                  maxBarSize={stacked ? 28 : 22}
                  // Empilhado: sem cantos (só o topo do total seria arredondado) e
                  // com um filete na cor do fundo separando os segmentos.
                  stackId={stacked ? 'total' : undefined}
                  stroke={stacked ? 'var(--surface)' : undefined}
                  strokeWidth={stacked ? 2 : undefined}
                  radius={stacked ? 0 : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                  animationDuration={500}
                />
              )
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Período</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              {series.map((s) => (
                <td key={s.key}>{row[s.key] === null ? '—' : formatBRL(Number(row[s.key] ?? 0))}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
