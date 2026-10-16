import type { FinanceData, ISODate } from '@/types'
import { diffDays, formatDate, monthOf, relativeDay, todayISO } from './date'
import { budgetStatuses, cardInvoices, cardUsage, goalStatus, summarize, upcomingBills } from './finance'
import { formatBRL, formatPercent } from './money'

export type Severity = 'info' | 'warning' | 'critical'

export interface AppNotification {
  /** Chave estável: é o que fica gravado quando o usuário dispensa o alerta. */
  key: string
  severity: Severity
  title: string
  body: string
  link: string
}

const DUE_SOON_DAYS = 3

/** Alertas internos, recalculados a partir dos dados a cada mudança. */
export function buildNotifications(data: FinanceData, today: ISODate = todayISO()): AppNotification[] {
  const month = monthOf(today)
  const out: AppNotification[] = []

  for (const bill of upcomingBills(data, today, DUE_SOON_DAYS)) {
    const late = bill.date < today
    out.push({
      key: `bill:${bill.id}`,
      severity: late ? 'critical' : 'warning',
      title: late ? `${bill.label} está atrasada` : `${bill.label} vence ${relativeDay(bill.date, today)}`,
      body: `${formatBRL(bill.amount)} · vencimento ${formatDate(bill.date)}`,
      link: bill.cardId ? `/cartoes/${bill.cardId}` : '/calendario',
    })
  }

  for (const b of budgetStatuses(data, month, today)) {
    if (b.level === 'ok' || !b.category) continue
    out.push({
      key: `budget:${b.budget.id}:${month}:${b.level}`,
      severity: b.level === 'over' ? 'critical' : 'warning',
      title:
        b.level === 'over'
          ? `Orçamento de ${b.category.name} ultrapassado`
          : `Orçamento de ${b.category.name} em ${formatPercent(b.pct)}`,
      body:
        b.level === 'over'
          ? `Você passou ${formatBRL(-b.remaining)} do limite de ${formatBRL(b.budget.limit_cents)}.`
          : `Restam ${formatBRL(b.remaining)} de ${formatBRL(b.budget.limit_cents)}.`,
      link: '/orcamento',
    })
  }

  for (const card of data.cards) {
    const usage = cardUsage(data, card)
    if (usage.pct >= 0.8) {
      out.push({
        key: `card-limit:${card.id}:${month}`,
        severity: usage.pct >= 1 ? 'critical' : 'warning',
        title: `Cartão ${card.name} perto do limite`,
        body: `${formatPercent(usage.pct)} do limite utilizado · ${formatBRL(Math.max(0, usage.available))} disponível.`,
        link: `/cartoes/${card.id}`,
      })
    }
    // Faturas vencendo já entram por `upcomingBills`; aqui só a fatura aberta alta.
    const open = cardInvoices(data, card, today).find((i) => i.status === 'open')
    if (open && card.limit_cents > 0 && open.total >= card.limit_cents * 0.8 && usage.pct < 0.8) {
      out.push({
        key: `invoice-high:${card.id}:${open.key}`,
        severity: 'warning',
        title: `Fatura do ${card.name} está alta`,
        body: `${formatBRL(open.total)} na fatura aberta, que fecha em ${formatDate(open.closingDate)}.`,
        link: `/cartoes/${card.id}`,
      })
    }
  }

  for (const goal of data.goals) {
    const status = goalStatus(data, goal, today)
    if (!status.done && status.pct >= 0.9) {
      out.push({
        key: `goal-near:${goal.id}`,
        severity: 'info',
        title: `Meta ${goal.name} quase concluída`,
        body: `${formatPercent(status.pct)} alcançado · faltam ${formatBRL(status.remaining)}.`,
        link: '/metas',
      })
    }
  }

  const summary = summarize(data, month, today)
  if (summary.projected < 0) {
    out.push({
      key: `projected-negative:${month}`,
      severity: 'critical',
      title: 'Saldo projetado do mês está negativo',
      body: `Com as despesas previstas, o mês fecharia em ${formatBRL(summary.projected)}.`,
      link: '/',
    })
  }

  const dismissed = new Set(data.notifications.map((n) => n.key))
  const rank: Record<Severity, number> = { critical: 0, warning: 1, info: 2 }
  return out.filter((n) => !dismissed.has(n.key)).sort((a, b) => rank[a.severity] - rank[b.severity])
}

export const isOverdue = (date: ISODate, today: ISODate = todayISO()) => diffDays(today, date) < 0
