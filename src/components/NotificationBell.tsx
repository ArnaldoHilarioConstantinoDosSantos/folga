import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, BellOff, CircleAlert, Info, TriangleAlert, X, type LucideIcon } from 'lucide-react'
import { useFinance } from '@/contexts/FinanceContext'
import { useDb } from '@/hooks/useDb'
import { cn } from '@/lib/cn'
import { db as driver } from '@/services/db'
import { buildNotifications, type AppNotification, type Severity } from '@/utils/notifications'
import { EmptyState } from './EmptyState'

const SEVERITY: Record<Severity, { icon: LucideIcon; className: string }> = {
  critical: { icon: CircleAlert, className: 'bg-neg-soft text-neg' },
  warning: { icon: TriangleAlert, className: 'bg-warn-soft text-warn' },
  info: { icon: Info, className: 'bg-brand-soft text-brand' },
}

/** Sino de alertas: calculados dos dados; dispensar grava a chave no banco. */
export function NotificationBell() {
  const data = useFinance()
  const db = useDb()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const items = useMemo(() => buildNotifications(data), [data])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const stamp = () => new Date().toISOString()
  const dismiss = (n: AppNotification) => db.create('notifications', { key: n.key, dismissed_at: stamp() })
  const dismissAll = () =>
    db.run(async () => {
      await driver.insert(
        'notifications',
        items.map((n) => ({ key: n.key, dismissed_at: stamp() })),
      )
      return ['notifications']
    })

  const go = (n: AppNotification) => {
    setOpen(false)
    navigate(n.link)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={items.length ? `Alertas: ${items.length} novos` : 'Alertas'}
        className="relative flex size-10 items-center justify-center rounded-xl text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <Bell className="size-[18px]" aria-hidden />
        {items.length > 0 && (
          <span className="absolute top-1.5 right-1.5 flex min-w-4 items-center justify-center rounded-full bg-neg px-1 text-[10px] leading-4 font-bold text-white dark:text-[#2a0d0b]">
            {items.length > 9 ? '9+' : items.length}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Alertas"
          className="fixed inset-x-3 top-16 z-40 animate-pop-in rounded-2xl border border-line bg-surface shadow-pop sm:absolute sm:inset-x-auto sm:top-12 sm:right-0 sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-bold text-ink">Alertas</h2>
            {items.length > 0 && (
              <button
                type="button"
                onClick={dismissAll}
                className="text-xs font-semibold text-brand hover:underline"
              >
                Dispensar todos
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <EmptyState compact icon={BellOff} title="Tudo em dia" description="Nenhum alerta no momento." />
          ) : (
            <ul className="scroll-thin max-h-[60dvh] divide-y divide-line overflow-y-auto">
              {items.map((n) => {
                const { icon: Icon, className } = SEVERITY[n.severity]
                return (
                  <li key={n.key} className="flex items-start gap-3 px-4 py-3">
                    <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg', className)}>
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <button type="button" onClick={() => go(n)} className="min-w-0 flex-1 text-left">
                      <span className="block text-[13px] font-bold text-ink">{n.title}</span>
                      <span className="block text-xs text-muted">{n.body}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => dismiss(n)}
                      aria-label={`Dispensar alerta: ${n.title}`}
                      className="rounded-md p-1 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
