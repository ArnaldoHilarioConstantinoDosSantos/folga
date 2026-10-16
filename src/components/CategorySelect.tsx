import type { SelectHTMLAttributes } from 'react'
import { useFinance } from '@/contexts/FinanceContext'
import type { TxType } from '@/types'
import { categoryIndex } from '@/utils/finance'
import { Select } from './ui/Form'

interface CategorySelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> {
  value: string | null
  onChange: (id: string | null) => void
  type?: TxType
  /** Só categorias principais (orçamento e planejamento trabalham nesse nível). */
  rootsOnly?: boolean
  emptyLabel?: string
}

/** Seletor de categoria com as subcategorias agrupadas sob a principal. */
export function CategorySelect({
  value,
  onChange,
  type,
  rootsOnly = false,
  emptyLabel = 'Sem categoria',
  ...props
}: CategorySelectProps) {
  const { categories } = useFinance()
  const index = categoryIndex(categories)
  const roots = index.roots
    .filter((c) => !type || c.type === type)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  return (
    <Select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} {...props}>
      <option value="">{emptyLabel}</option>
      {roots.map((root) => {
        const children = rootsOnly ? [] : index.childrenOf(root.id)
        if (children.length === 0) {
          return (
            <option key={root.id} value={root.id}>
              {root.name}
            </option>
          )
        }
        return (
          <optgroup key={root.id} label={root.name}>
            <option value={root.id}>{root.name} (geral)</option>
            {children.map((child) => (
              <option key={child.id} value={child.id}>
                {child.name}
              </option>
            ))}
          </optgroup>
        )
      })}
    </Select>
  )
}
