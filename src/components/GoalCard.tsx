import { CircleCheck, Pencil, Plus, Trash2 } from 'lucide-react'
import { monthLabelSlash } from '@/utils/date'
import type { GoalStatus } from '@/utils/finance'
import { colorVar } from '@/utils/labels'
import { formatBRL, formatPercent } from '@/utils/money'
import { CategoryIcon } from './CategoryIcon'
import { Button, IconButton } from './ui/Button'
import { Card } from './ui/Card'
import { Badge, ProgressBar } from './ui/Feedback'

interface GoalCardProps {
  status: GoalStatus
  onDeposit: () => void
  onEdit: () => void
  onDelete: () => void
}

export function GoalCard({ status, onDeposit, onEdit, onDelete }: GoalCardProps) {
  const { goal, saved, pct, remaining, done, eta, monthlyPace } = status

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <CategoryIcon icon={goal.icon} color={goal.color} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold text-ink">{goal.name}</h3>
          <p className="text-[13px] text-muted">
            {goal.kind === 'emergency' ? 'Reserva de emergência' : 'Meta financeira'}
          </p>
        </div>
        <div className="-mt-1 -mr-2 flex">
          <IconButton icon={Pencil} label={`Editar meta ${goal.name}`} onClick={onEdit} />
          <IconButton icon={Trash2} label={`Excluir meta ${goal.name}`} tone="danger" onClick={onDelete} />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted">Guardado</p>
            <p className="text-xl font-extrabold tracking-tight text-ink">{formatBRL(saved)}</p>
          </div>
          <p className="tnum text-right text-[13px] text-muted">
            de {formatBRL(goal.target_cents)}
            <span className="ml-2 text-base font-extrabold text-ink">{formatPercent(pct)}</span>
          </p>
        </div>
        <ProgressBar value={pct} color={colorVar(goal.color)} label={`${goal.name}: ${formatPercent(pct)} da meta`} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {done ? (
          <Badge tone="pos">
            <CircleCheck className="size-3.5" aria-hidden />
            Meta concluída
          </Badge>
        ) : (
          <p className="text-[13px] text-ink-2">
            {eta ? (
              <>
                Previsão: <span className="font-bold text-ink">{monthLabelSlash(eta)}</span>
                <span className="text-muted"> · {formatBRL(monthlyPace)}/mês</span>
              </>
            ) : (
              <>
                Faltam <span className="font-bold text-ink">{formatBRL(remaining)}</span>
              </>
            )}
          </p>
        )}
        <Button variant="secondary" size="sm" icon={Plus} onClick={onDeposit}>
          Depósito
        </Button>
      </div>
    </Card>
  )
}
