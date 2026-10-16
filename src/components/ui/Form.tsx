import {
  useId,
  type ComponentProps,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

const CONTROL =
  'w-full rounded-xl border border-line bg-surface text-sm text-ink transition-colors placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none disabled:opacity-60 aria-[invalid=true]:border-neg'

interface FieldProps {
  label: string
  error?: string
  hint?: string
  className?: string
  /** Recebe o id para ligar o rótulo ao controle. */
  children: (id: string) => ReactNode
}

export function Field({ label, error, hint, className, children }: FieldProps) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-ink-2">
        {label}
      </label>
      {children(id)}
      {error ? (
        <p role="alert" className="mt-1 text-xs font-medium text-neg">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-muted">{hint}</p>
      )}
    </div>
  )
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(CONTROL, 'h-10 px-3', className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={2} className={cn(CONTROL, 'resize-none px-3 py-2', className)} {...props} />
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn('relative', className)}>
      <select className={cn(CONTROL, 'h-10 appearance-none pr-9 pl-3')} {...props}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted"
        aria-hidden
      />
    </div>
  )
}

interface MoneyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'size'> {
  /** Valor em centavos. */
  value: number
  onChange: (cents: number) => void
  size?: 'md' | 'lg'
}

const MAX_CENTS = 99_999_999_999

/**
 * Campo de valor no estilo dos apps de banco: os dígitos entram pela direita
 * (digitar 1250 mostra 12,50), sem precisar de vírgula ou ponto.
 */
export function MoneyInput({ value, onChange, size = 'md', className, ...props }: MoneyInputProps) {
  const text = (value / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (
    <div className="relative">
      <span
        className={cn(
          'pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-semibold text-muted',
          size === 'lg' ? 'text-lg' : 'text-sm',
        )}
      >
        R$
      </span>
      <input
        inputMode="numeric"
        autoComplete="off"
        value={text}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '')
          onChange(digits ? Math.min(Number.parseInt(digits, 10), MAX_CENTS) : 0)
        }}
        onFocus={(e) => e.target.select()}
        className={cn(
          CONTROL,
          'tnum font-semibold',
          size === 'lg' ? 'h-14 pr-3 pl-12 text-2xl' : 'h-10 pr-3 pl-10',
          className,
        )}
        {...props}
      />
    </div>
  )
}

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}

export function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  return (
    <label className={cn('flex items-center justify-between gap-4', disabled && 'opacity-60')}>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-brand' : 'bg-line',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-5',
          )}
        />
      </button>
    </label>
  )
}
