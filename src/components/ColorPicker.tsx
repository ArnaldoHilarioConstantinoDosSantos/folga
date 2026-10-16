import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { ICONS, ICON_KEYS } from '@/lib/icons'
import type { ColorKey } from '@/types'
import { COLOR_KEYS, COLOR_NAMES, colorVar } from '@/utils/labels'

export function ColorPicker({ value, onChange }: { value: ColorKey; onChange: (color: ColorKey) => void }) {
  return (
    <div role="radiogroup" aria-label="Cor" className="flex flex-wrap gap-2">
      {COLOR_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          aria-label={COLOR_NAMES[key]}
          title={COLOR_NAMES[key]}
          onClick={() => onChange(key)}
          className={cn(
            'flex size-8 items-center justify-center rounded-full text-white transition-transform hover:scale-110',
            value === key && 'ring-2 ring-ink ring-offset-2 ring-offset-surface',
          )}
          style={{ background: colorVar(key) }}
        >
          {value === key && <Check className="size-4" strokeWidth={3} aria-hidden />}
        </button>
      ))}
    </div>
  )
}

interface IconPickerProps {
  value: string
  onChange: (icon: string) => void
  color: ColorKey
}

export function IconPicker({ value, onChange, color }: IconPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Ícone"
      className="scroll-thin grid max-h-40 grid-cols-8 gap-1.5 overflow-y-auto rounded-xl border border-line p-2 sm:grid-cols-10"
    >
      {ICON_KEYS.map((key) => {
        const Icon = ICONS[key]
        const selected = value === key
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`Ícone ${key}`}
            onClick={() => onChange(key)}
            className={cn(
              'flex aspect-square items-center justify-center rounded-lg transition-colors',
              selected ? 'text-white' : 'text-ink-2 hover:bg-surface-2',
            )}
            style={selected ? { background: colorVar(color) } : undefined}
          >
            <Icon className="size-4" aria-hidden />
          </button>
        )
      })}
    </div>
  )
}
