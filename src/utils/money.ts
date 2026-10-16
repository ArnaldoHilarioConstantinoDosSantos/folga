const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const brlCompact = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** Formata centavos como "R$ 1.250,00". */
export function formatBRL(cents: number, opts: { sign?: boolean; compact?: boolean } = {}): string {
  const value = cents / 100
  const text = (opts.compact ? brlCompact : brl).format(Math.abs(value)).replace(/ /g, ' ')
  if (value < 0) return `- ${text}`
  return opts.sign && value > 0 ? `+ ${text}` : text
}

/** Formata uma razão (0,18) como "18%"; `digits` casas decimais no padrão brasileiro. */
export function formatPercent(ratio: number, digits = 0): string {
  if (!Number.isFinite(ratio)) return '—'
  return `${(ratio * 100).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`
}

export function formatNumber(value: number, digits = 1): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** Converte o que foi digitado ("1.250,00", "1250", "R$ 12,5") em centavos. */
export function parseBRL(text: string): number {
  const clean = text.replace(/[^\d,.-]/g, '')
  if (!clean) return 0
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean
  const value = Number(normalized)
  return Number.isFinite(value) ? Math.round(value * 100) : 0
}

export function sumBy<T>(list: readonly T[], fn: (item: T) => number): number {
  let total = 0
  for (const item of list) total += fn(item)
  return total
}

export const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : 0)

/**
 * Divide um total em `count` parcelas inteiras em centavos. Os centavos que
 * sobram da divisão vão para as primeiras parcelas, então a soma é sempre exata.
 */
export function splitInstallments(totalCents: number, count: number): number[] {
  const n = Math.max(1, Math.floor(count))
  const base = Math.floor(totalCents / n)
  const remainder = totalCents - base * n
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0))
}
