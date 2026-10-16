import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { CircleAlert, CircleCheck, X } from 'lucide-react'
import { cn } from '@/lib/cn'

type ToastKind = 'success' | 'error'

interface Toast {
  id: number
  kind: ToastKind
  message: string
}

interface ToastValue {
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), [])

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++
      setToasts((list) => [...list.slice(-2), { id, kind, message }])
      window.setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3200)
    },
    [dismiss],
  )

  const value = useMemo<ToastValue>(
    () => ({ success: (m) => push('success', m), error: (m) => push('error', m) }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6"
      >
        {toasts.map((toast) => {
          const Icon = toast.kind === 'success' ? CircleCheck : CircleAlert
          return (
            <div
              key={toast.id}
              role={toast.kind === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex w-full max-w-sm animate-pop-in items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-pop"
            >
              <Icon
                className={cn('mt-0.5 size-5 shrink-0', toast.kind === 'success' ? 'text-pos' : 'text-neg')}
                aria-hidden
              />
              <p className="flex-1 text-sm font-medium text-ink">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded-md text-muted transition-colors hover:text-ink"
                aria-label="Fechar aviso"
              >
                <X className="size-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast precisa estar dentro de ToastProvider')
  return ctx
}
