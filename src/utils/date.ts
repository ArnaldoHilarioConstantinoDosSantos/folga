import type { ISODate, MonthKey } from '@/types'

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export const pad = (n: number) => String(n).padStart(2, '0')

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Constrói a data no fuso local — `new Date('YYYY-MM-DD')` usaria UTC. */
export function parseISO(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d || 1)
}

export const todayISO = (): ISODate => toISO(new Date())
export const monthOf = (iso: ISODate): MonthKey => iso.slice(0, 7)
export const currentMonth = (): MonthKey => monthOf(todayISO())
export const dayOf = (iso: ISODate) => Number(iso.slice(8, 10))
export const yearOf = (key: string) => Number(key.slice(0, 4))
export const monthNumber = (key: string) => Number(key.slice(5, 7))

export function addMonths(month: MonthKey, n: number): MonthKey {
  const total = yearOf(month) * 12 + (monthNumber(month) - 1) + n
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`
}

/** Quantos meses `to` está à frente de `from`. */
export function monthDiff(from: MonthKey, to: MonthKey): number {
  return yearOf(to) * 12 + monthNumber(to) - (yearOf(from) * 12 + monthNumber(from))
}

export function daysInMonth(month: MonthKey): number {
  return new Date(yearOf(month), monthNumber(month), 0).getDate()
}

/** Dia do mês limitado ao tamanho do mês (dia 31 em fevereiro vira 28/29). */
export function dateInMonth(month: MonthKey, day: number): ISODate {
  return `${month}-${pad(Math.min(Math.max(day, 1), daysInMonth(month)))}`
}

export const startOfMonth = (month: MonthKey): ISODate => `${month}-01`
export const endOfMonth = (month: MonthKey): ISODate => dateInMonth(month, 31)

export function addMonthsToDate(iso: ISODate, n: number): ISODate {
  return dateInMonth(addMonths(monthOf(iso), n), dayOf(iso))
}

export function addDays(iso: ISODate, n: number): ISODate {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export function diffDays(from: ISODate, to: ISODate): number {
  return Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / 86_400_000)
}

/** Os `n` meses que terminam em `end`, em ordem crescente. */
export function lastMonths(end: MonthKey, n: number): MonthKey[] {
  return Array.from({ length: n }, (_, i) => addMonths(end, i - (n - 1)))
}

export function monthsFrom(start: MonthKey, n: number): MonthKey[] {
  return Array.from({ length: n }, (_, i) => addMonths(start, i))
}

export const monthName = (month: MonthKey) => MONTHS[monthNumber(month) - 1]
export const monthLabel = (month: MonthKey) => `${monthName(month)} ${yearOf(month)}`
export const monthLabelSlash = (month: MonthKey) => `${monthName(month)}/${yearOf(month)}`
export const monthShort = (month: MonthKey) =>
  `${MONTHS_SHORT[monthNumber(month) - 1]}/${String(yearOf(month)).slice(2)}`

export function formatDate(iso: ISODate | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function formatDayMonth(iso: ISODate): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

/** "hoje", "amanhã", "em 3 dias", "há 2 dias". */
export function relativeDay(iso: ISODate, today: ISODate = todayISO()): string {
  const d = diffDays(today, iso)
  if (d === 0) return 'hoje'
  if (d === 1) return 'amanhã'
  if (d === -1) return 'ontem'
  return d > 0 ? `em ${d} dias` : `há ${-d} dias`
}
