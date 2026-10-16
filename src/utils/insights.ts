import type { FinanceData, ISODate, MonthKey } from '@/types'
import { addMonths, dayOf, monthName, monthOf, todayISO } from './date'
import {
  averageMonthlySavings,
  categoryIndex,
  expensesByCategory,
  fixedMonthlyTotal,
  goalStatus,
  referenceIncome,
  summarize,
} from './finance'
import { formatBRL, formatPercent, ratio } from './money'

export type Tone = 'good' | 'bad' | 'neutral'

export interface Insight {
  id: string
  tone: Tone
  text: string
}

/**
 * Para o mês em andamento, compara só até o dia de hoje com o mesmo trecho do
 * mês anterior — comparar meio mês com um mês inteiro daria sempre "caiu".
 */
function comparison(month: MonthKey, today: ISODate) {
  const partial = month === monthOf(today)
  return {
    previous: addMonths(month, -1),
    untilDay: partial ? dayOf(today) : undefined,
    suffix: partial ? ' no mesmo período do mês anterior' : ' em relação ao mês anterior',
    partial,
  }
}

/** Frases sob o gráfico de evolução, comparando o mês com o anterior. */
export function trendMessages(data: FinanceData, month: MonthKey, today: ISODate = todayISO()): Insight[] {
  const { previous, untilDay, partial } = comparison(month, today)
  const cur = summarize(data, month, today, untilDay)
  const prev = summarize(data, previous, today, untilDay)
  const out: Insight[] = []

  if (prev.expense > 0 && cur.expense > 0) {
    const change = (cur.expense - prev.expense) / prev.expense
    if (Math.abs(change) >= 0.01) {
      const verb = change < 0 ? 'diminuíram' : 'aumentaram'
      const amount = formatPercent(Math.abs(change))
      out.push({
        id: 'expense-change',
        tone: change < 0 ? 'good' : 'bad',
        text: partial
          ? `Até o dia ${dayOf(today)}, os gastos ${verb} ${amount} em relação ao mesmo período do mês anterior.`
          : `Gastos ${verb} ${amount} em relação ao mês anterior.`,
      })
    }
  }

  if (!partial && (prev.income > 0 || prev.expense > 0) && cur.income > 0) {
    const diff = cur.balance - prev.balance
    if (diff !== 0) {
      out.push({
        id: 'savings-diff',
        tone: diff > 0 ? 'good' : 'bad',
        text: `Você economizou ${formatBRL(Math.abs(diff))} a ${diff > 0 ? 'mais' : 'menos'} que no mês anterior.`,
      })
    }
    if (prev.income > 0 && formatPercent(prev.savingsRate) !== formatPercent(cur.savingsRate)) {
      const up = cur.savingsRate > prev.savingsRate
      out.push({
        id: 'savings-rate',
        tone: up ? 'good' : 'bad',
        text: `Seu percentual de economia ${up ? 'aumentou' : 'caiu'} de ${formatPercent(
          prev.savingsRate,
        )} para ${formatPercent(cur.savingsRate)}.`,
      })
    }
  }

  if (partial && cur.income > 0 && cur.pendingExpense > 0) {
    out.push({
      id: 'projected',
      tone: cur.projected >= 0 ? 'good' : 'bad',
      text: `Mantendo as contas previstas, o mês fecha com ${formatBRL(cur.projected)} de saldo.`,
    })
  }

  return out
}

/** "Insights do mês": todos derivados dos lançamentos, nada fixo no código. */
export function monthInsights(data: FinanceData, month: MonthKey, today: ISODate = todayISO()): Insight[] {
  const { previous, untilDay, suffix } = comparison(month, today)
  const out: Insight[] = []
  const summary = summarize(data, month, today)
  const income = referenceIncome(data, month, today)
  const index = categoryIndex(data.categories)

  // 1. Economia do mês
  if (summary.income > 0) {
    if (summary.balance >= 0) {
      out.push({
        id: 'savings',
        tone: summary.savingsRate >= 0.1 ? 'good' : 'neutral',
        text: `Você economizou ${formatPercent(summary.savingsRate)} da sua renda neste mês${
          untilDay ? ' até agora' : ''
        }.`,
      })
    } else {
      out.push({
        id: 'savings',
        tone: 'bad',
        text: `Suas despesas superaram suas receitas em ${formatBRL(-summary.balance)} neste mês.`,
      })
    }
  }

  // 2. Variações por categoria (comparação justa de períodos)
  const current = expensesByCategory(data, month, today, { untilDay })
  const before = new Map(expensesByCategory(data, previous, today, { untilDay }).map((c) => [c.id, c.total]))
  const deltas = current
    .filter((c) => c.category && before.has(c.id))
    .map((c) => ({ name: c.category!.name, diff: c.total - before.get(c.id)!, prev: before.get(c.id)! }))

  const biggestDrop = deltas.filter((d) => d.diff <= -2000).sort((a, b) => a.diff - b.diff)[0]
  if (biggestDrop) {
    out.push({
      id: 'drop',
      tone: 'good',
      text: `Você gastou ${formatBRL(-biggestDrop.diff)} a menos com ${biggestDrop.name.toLowerCase()}${suffix}.`,
    })
  }

  // Subcategoria que mais cresceu em percentual (ex.: delivery +23%)
  const leafNow = expensesByCategory(data, month, today, { level: 'leaf', untilDay })
  const leafBefore = new Map(
    expensesByCategory(data, previous, today, { level: 'leaf', untilDay }).map((c) => [c.id, c.total]),
  )
  const rise = leafNow
    .filter((c) => c.category && (leafBefore.get(c.id) ?? 0) > 0)
    .map((c) => {
      const prev = leafBefore.get(c.id)!
      return { name: c.category!.name, diff: c.total - prev, change: (c.total - prev) / prev }
    })
    .filter((d) => d.change >= 0.1 && d.diff >= 2000)
    .sort((a, b) => b.diff - a.diff)[0]
  if (rise) {
    out.push({
      id: 'rise',
      tone: 'bad',
      text: `Seus gastos com ${rise.name.toLowerCase()} aumentaram ${formatPercent(rise.change)}${suffix}.`,
    })
  }

  // 3. Maior categoria
  const top = expensesByCategory(data, month, today)[0]
  if (top?.category && income > 0) {
    out.push({
      id: 'top',
      tone: 'neutral',
      text: `${top.category.name} é sua maior despesa do mês: ${formatBRL(top.total)} (${formatPercent(
        ratio(top.total, income),
      )} da renda).`,
    })
  }

  // 4. Assinaturas
  const subscriptions = expensesByCategory(data, month, today, { includePending: true }).find(
    (c) => c.category && /assinatura/i.test(c.category.name),
  )
  if (subscriptions && income > 0) {
    out.push({
      id: 'subscriptions',
      tone: 'neutral',
      text: `Suas assinaturas representam ${formatPercent(ratio(subscriptions.total, income), 1)} da sua renda.`,
    })
  }

  // 5. Gastos fixos
  const fixed = fixedMonthlyTotal(data)
  if (fixed > 0 && income > 0) {
    const share = ratio(fixed, income)
    out.push({
      id: 'fixed',
      tone: share > 0.5 ? 'bad' : 'neutral',
      text: `${formatPercent(share)} da sua renda já está comprometida com gastos fixos.`,
    })
  }

  // 6. Metas: ritmo atual de aportes ou, na falta deles, a economia média
  const averageSavings = averageMonthlySavings(data, today)
  for (const goal of data.goals) {
    const status = goalStatus(data, goal, today)
    if (status.done) continue
    const pace = status.monthlyPace || averageSavings
    if (pace <= 0) continue
    const months = Math.ceil(status.remaining / pace)
    if (months > 240) continue
    out.push({
      id: `goal-${goal.id}`,
      tone: 'neutral',
      text: `Se mantiver sua média atual de ${
        status.monthlyPace ? 'aportes' : 'economia'
      }, sua meta ${goal.name} será atingida em aproximadamente ${months} ${months === 1 ? 'mês' : 'meses'}.`,
    })
    break
  }

  // 7. Categoria sem uso de categoria (qualidade dos dados)
  const uncategorized = current.find((c) => c.id === 'none')
  if (uncategorized && uncategorized.total > 0 && index.roots.length > 0) {
    out.push({
      id: 'uncategorized',
      tone: 'neutral',
      text: `${formatBRL(uncategorized.total)} em despesas de ${monthName(month).toLowerCase()} estão sem categoria.`,
    })
  }

  return out
}
