import { cn } from '@/lib/cn'
import { iconOf } from '@/lib/icons'
import type { ColorKey } from '@/types'
import { colorVar, softColor } from '@/utils/labels'

interface CategoryIconProps {
  icon: string | null | undefined
  color: ColorKey | null | undefined
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const BOX = { sm: 'size-8 rounded-lg', md: 'size-10 rounded-xl', lg: 'size-12 rounded-2xl' }
const GLYPH = { sm: 'size-4', md: 'size-[18px]', lg: 'size-5' }

/** Ícone sobre um fundo suave da mesma cor — usado em categorias, contas e metas. */
export function CategoryIcon({ icon, color, size = 'md', className }: CategoryIconProps) {
  const Icon = iconOf(icon)
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center', BOX[size], className)}
      style={{ background: softColor(color), color: colorVar(color) }}
      aria-hidden
    >
      <Icon className={GLYPH[size]} />
    </span>
  )
}
