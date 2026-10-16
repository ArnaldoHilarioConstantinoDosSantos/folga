import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { Category } from '@/types'
import { CategoryIcon } from './CategoryIcon'
import { IconButton } from './ui/Button'
import { Card } from './ui/Card'

interface CategoryCardProps {
  category: Category
  subcategories: Category[]
  onEdit: (category: Category) => void
  onDelete: (category: Category) => void
  onAddSub: (parent: Category) => void
}

export function CategoryCard({ category, subcategories, onEdit, onDelete, onAddSub }: CategoryCardProps) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <CategoryIcon icon={category.icon} color={category.color} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-bold text-ink">{category.name}</h3>
          <p className="text-xs text-muted">
            {subcategories.length === 0
              ? 'Sem subcategorias'
              : `${subcategories.length} ${subcategories.length === 1 ? 'subcategoria' : 'subcategorias'}`}
          </p>
        </div>
        <div className="-mr-2 flex">
          <IconButton icon={Pencil} label={`Editar ${category.name}`} onClick={() => onEdit(category)} />
          <IconButton icon={Trash2} label={`Excluir ${category.name}`} tone="danger" onClick={() => onDelete(category)} />
        </div>
      </div>

      <ul className="flex flex-wrap gap-1.5">
        {subcategories.map((sub) => (
          <li key={sub.id} className="group/sub flex items-center rounded-lg bg-surface-2 text-[13px] font-medium text-ink-2">
            <button
              type="button"
              onClick={() => onEdit(sub)}
              className="rounded-lg py-1 pr-1 pl-2.5 transition-colors hover:text-ink"
              aria-label={`Editar subcategoria ${sub.name}`}
            >
              {sub.name}
            </button>
            <button
              type="button"
              onClick={() => onDelete(sub)}
              className="rounded-md p-1 pr-1.5 text-muted transition-colors hover:text-neg"
              aria-label={`Excluir subcategoria ${sub.name}`}
            >
              <Trash2 className="size-3" aria-hidden />
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => onAddSub(category)}
            className="flex items-center gap-1 rounded-lg border border-dashed border-line px-2.5 py-1 text-[13px] font-semibold text-muted transition-colors hover:border-brand hover:text-brand"
          >
            <Plus className="size-3.5" aria-hidden />
            Subcategoria
          </button>
        </li>
      </ul>
    </Card>
  )
}
