import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { LoaderCircle, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-brand-ink hover:bg-brand-strong shadow-sm',
  secondary: 'bg-surface-2 text-ink hover:bg-line',
  outline: 'border border-line bg-surface text-ink hover:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'bg-neg text-white hover:opacity-90 dark:text-[#2a0d0b]',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-[13px]',
  md: 'h-10 gap-2 rounded-xl px-4 text-sm',
  lg: 'h-12 gap-2 rounded-xl px-5 text-[15px]',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: LucideIcon
  loading?: boolean
  children?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-all duration-150 active:scale-[0.98] disabled:opacity-55 disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
      ) : (
        Icon && <Icon className="size-4" aria-hidden />
      )}
      {children}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  /** Obrigatório: é o nome acessível do botão. */
  label: string
  tone?: 'default' | 'danger'
}

export function IconButton({ icon: Icon, label, tone = 'default', className, type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 disabled:opacity-50',
        tone === 'danger' ? 'hover:text-neg' : 'hover:text-ink',
        className,
      )}
      {...props}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  )
}
