import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { IconButton } from './Button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
  footer?: ReactNode
}

const SIZES = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }

/** Diálogo modal: centralizado no desktop, folha que sobe de baixo no celular. */
export function Modal({ open, onClose, title, description, size = 'md', children, footer }: ModalProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Foco no primeiro campo; se não houver, no próprio painel.
    const first = panelRef.current?.querySelector<HTMLElement>('[data-autofocus], input, select, textarea')
    ;(first ?? panelRef.current)?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-black/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92dvh] w-full animate-sheet-in flex-col rounded-t-3xl border border-line bg-surface shadow-pop outline-none sm:animate-pop-in sm:rounded-2xl',
          SIZES[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-1 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-ink">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
          </div>
          <IconButton icon={X} label="Fechar" onClick={onClose} className="-mt-1 -mr-2" />
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4 sm:px-6">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
