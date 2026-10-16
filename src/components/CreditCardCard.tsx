import { Link } from 'react-router-dom'
import { ChevronRight, Pencil, Trash2 } from 'lucide-react'
import type { CreditCard } from '@/types'
import { colorVar } from '@/utils/labels'
import { formatBRL, formatPercent } from '@/utils/money'
import { IconButton } from './ui/Button'
import { Card } from './ui/Card'
import { ProgressBar } from './ui/Feedback'

interface CreditCardCardProps {
  card: CreditCard
  used: number
  available: number
  pct: number
  /** Total da fatura aberta, quando houver. */
  openInvoice?: number
  onEdit: () => void
  onDelete: () => void
}

export function CreditCardCard({ card, used, available, pct, openInvoice, onEdit, onDelete }: CreditCardCardProps) {
  const tone = pct >= 0.8 ? 'neg' : pct >= 0.6 ? 'warn' : 'brand'

  return (
    <Card padded={false} className="overflow-hidden">
      {/* Face do cartão */}
      <div
        className="relative flex h-36 flex-col justify-between overflow-hidden p-5 text-white"
        style={{ background: `linear-gradient(135deg, ${colorVar(card.color)}, color-mix(in srgb, ${colorVar(card.color)} 55%, #0b1410))` }}
      >
        <div className="pointer-events-none absolute -top-10 -right-8 size-36 rounded-full bg-white/10" aria-hidden />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-lg font-extrabold tracking-tight">{card.name}</p>
            <p className="text-xs font-medium opacity-80">{card.bank}</p>
          </div>
          <div className="-mt-1 -mr-2 flex">
            <IconButton
              icon={Pencil}
              label={`Editar cartão ${card.name}`}
              onClick={onEdit}
              className="text-white/80 hover:bg-white/15 hover:text-white"
            />
            <IconButton
              icon={Trash2}
              label={`Excluir cartão ${card.name}`}
              onClick={onDelete}
              className="text-white/80 hover:bg-white/15 hover:text-white"
            />
          </div>
        </div>
        <div className="relative flex items-end justify-between text-xs font-medium">
          <span className="opacity-80">
            Fecha dia {card.closing_day} · Vence dia {card.due_day}
          </span>
          <span className="tnum opacity-80">Limite {formatBRL(card.limit_cents)}</span>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div>
          <div className="mb-2 flex items-baseline justify-between text-[13px]">
            <span className="text-muted">
              Utilizado <span className="tnum font-bold text-ink">{formatBRL(used)}</span>
            </span>
            <span className="tnum font-bold text-ink">{formatPercent(pct)}</span>
          </div>
          <ProgressBar value={pct} tone={tone} label={`${card.name}: ${formatPercent(pct)} do limite utilizado`} />
          <p className="mt-2 text-[13px] text-muted">
            Disponível <span className="tnum font-bold text-ink">{formatBRL(available)}</span>
          </p>
        </div>
        <Link
          to={`/cartoes/${card.id}`}
          className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-line"
        >
          <span>
            Ver fatura
            {openInvoice !== undefined && (
              <span className="tnum ml-2 font-medium text-muted">aberta: {formatBRL(openInvoice)}</span>
            )}
          </span>
          <ChevronRight className="size-4 text-muted" aria-hidden />
        </Link>
      </div>
    </Card>
  )
}
