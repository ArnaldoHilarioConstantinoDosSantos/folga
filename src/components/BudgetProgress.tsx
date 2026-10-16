import { CircleAlert, Pencil, Trash2, TriangleAlert } from 'lucide-react'
import type { ColorKey } from '@/types'
import { budgetLevel } from '@/utils/finance'
import { formatBRL, formatPercent, ratio } from '@/utils/money'
import { CategoryIcon } from './CategoryIcon'
import { IconButton } from './ui/Button'
import { ProgressBar } from './ui/Feedback'

interface BudgetProgressProps {
  label: string
  icon?: string | null
  color?: ColorKey | null
  spent: number
  limit: number
  onEdit?: () => void
  onDelete?: () => void
}

/** Limite de gasto de uma categoria: barra, disponível e alerta a partir de 80%. */
export function BudgetProgress({ label, icon, color, spent, limit, onEdit, onDelete }: BudgetProgressProps) {
  const pct = ratio(spent, limit)
  const level = budgetLevel(pct)
  const remaining = limit - spent

  return (
    <div className="group">
      <div className="flex items-center gap-3">
        <CategoryIcon icon={icon} color={color} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-sm font-bold text-ink">{label}</p>
            <p className="tnum shrink-0 text-[13px] text-muted">
              <span className="font-bold text-ink">{formatBRL(spent)}</span> de {formatBRL(limit)}
            </p>
          </div>
          <div className="mt-2">
            <ProgressBar
              value={pct}
              tone={level === 'over' ? 'neg' : level === 'warn' ? 'warn' : 'brand'}
              label={`${label}: ${formatPercent(pct)} do limite`}
            />
          </div>
        </div>
        {(onEdit || onDelete) && (
          <div className="flex shrink-0 md:opacity-0 md:transition-opacity md:group-focus-within:opacity-100 md:group-hover:opacity-100">
            {onEdit && <IconButton icon={Pencil} label={`Editar limite de ${label}`} onClick={onEdit} />}
            {onDelete && (
              <IconButton icon={Trash2} label={`Excluir limite de ${label}`} tone="danger" onClick={onDelete} />
            )}
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 pl-[52px] text-xs">
        {level === 'over' ? (
          <span className="flex items-center gap-1 font-semibold text-neg">
            <CircleAlert className="size-3.5" aria-hidden />
            Limite ultrapassado em {formatBRL(-remaining)}
          </span>
        ) : level === 'warn' ? (
          <span className="flex items-center gap-1 font-semibold text-warn">
            <TriangleAlert className="size-3.5" aria-hidden />
            Atenção: {formatPercent(pct)} do limite usado
          </span>
        ) : (
          <span className="text-muted">{formatPercent(pct)} usado</span>
        )}
        {level !== 'over' && (
          <span className="tnum text-muted">
            Disponível: <span className="font-semibold text-ink-2">{formatBRL(remaining)}</span>
          </span>
        )}
      </div>
    </div>
  )
}
