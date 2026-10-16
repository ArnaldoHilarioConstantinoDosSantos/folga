import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { FlaskConical, LogOut, Menu, Moon, Plus, Sun, X } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { NotificationBell } from '@/components/NotificationBell'
import { Button, IconButton } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { useFinance } from '@/contexts/FinanceContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useToast } from '@/contexts/ToastContext'
import { TransactionModalProvider, useTransactionModal } from '@/contexts/TransactionModalContext'
import { cn } from '@/lib/cn'
import { MOBILE_PRIMARY, NAV_GROUPS, type NavItem } from './navigation'

function NavEntry({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
          isActive ? 'bg-brand-soft text-brand' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        )
      }
    >
      <item.icon className="size-[18px] shrink-0" aria-hidden />
      {item.label}
    </NavLink>
  )
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Navegação principal" className="space-y-5">
      {NAV_GROUPS.map((group, i) => (
        <div key={group.title ?? i}>
          {group.title && (
            <p className="mb-1.5 px-3 text-[11px] font-bold tracking-wider text-muted uppercase">{group.title}</p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.to}>
                <NavEntry item={item} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function UserBox() {
  const { user, signOut, demo } = useAuth()
  const { profile } = useFinance()
  const toast = useToast()
  const name = profile.full_name || user?.name || 'Você'

  return (
    <div className="space-y-3">
      {demo && (
        <Link
          to="/configuracoes"
          className="flex items-start gap-2.5 rounded-xl bg-warn-soft px-3 py-2.5 text-xs font-medium text-warn"
        >
          <FlaskConical className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            <span className="block font-bold">Modo demonstração</span>
            Dados salvos só neste navegador.
          </span>
        </Link>
      )}
      <div className="flex items-center gap-3 rounded-xl px-1">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">
          {name.trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">{name}</p>
          <p className="truncate text-xs text-muted">{user?.email}</p>
        </div>
        <IconButton
          icon={LogOut}
          label="Sair"
          onClick={() => signOut().catch((e: Error) => toast.error(e.message))}
        />
      </div>
    </div>
  )
}

function ThemeButton() {
  const { resolved, toggle } = useTheme()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={resolved === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
      className="flex size-10 items-center justify-center rounded-xl text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
    >
      {resolved === 'dark' ? <Sun className="size-[18px]" aria-hidden /> : <Moon className="size-[18px]" aria-hidden />}
    </button>
  )
}

function Shell() {
  const modal = useTransactionModal()
  const location = useLocation()
  const [drawer, setDrawer] = useState(false)

  useEffect(() => {
    setDrawer(false)
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  return (
    <div className="min-h-dvh overflow-x-clip">
      {/* Menu lateral (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
        <Link to="/" className="flex h-16 items-center px-6" aria-label="Folga — início">
          <Logo />
        </Link>
        <div className="scroll-thin flex-1 overflow-y-auto px-3 py-2">
          <NavList />
        </div>
        <div className="border-t border-line p-4">
          <UserBox />
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-line bg-bg/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <Link to="/" className="lg:hidden" aria-label="Folga — início">
            <Logo />
          </Link>
          <div className="ml-auto flex items-center gap-1">
            {/* No celular esse papel é do botão flutuante da barra inferior. */}
            <div className="mr-2 hidden lg:block">
              <Button icon={Plus} onClick={() => modal.create()}>
                Novo lançamento
              </Button>
            </div>
            <ThemeButton />
            <NotificationBell />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1240px] px-4 pt-6 pb-32 sm:px-6 lg:px-8 lg:pb-12">
          <div key={location.pathname} className="animate-rise">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Barra inferior (celular) */}
      <nav
        aria-label="Navegação rápida"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-5 items-end">
          {MOBILE_PRIMARY.slice(0, 2).map((item) => (
            <li key={item.to}>
              <MobileTab item={item} />
            </li>
          ))}
          <li className="flex justify-center">
            <button
              type="button"
              onClick={() => modal.create()}
              aria-label="Novo lançamento"
              className="-mt-6 mb-1.5 flex size-14 items-center justify-center rounded-full bg-brand text-brand-ink shadow-pop transition-transform active:scale-95"
            >
              <Plus className="size-6" aria-hidden />
            </button>
          </li>
          <li>
            <MobileTab item={MOBILE_PRIMARY[2]} />
          </li>
          <li>
            <button
              type="button"
              onClick={() => setDrawer(true)}
              aria-expanded={drawer}
              className="flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-semibold text-muted"
            >
              <Menu className="size-5" aria-hidden />
              Mais
            </button>
          </li>
        </ul>
      </nav>

      {/* Gaveta com o menu completo (celular) */}
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-black/45" onClick={() => setDrawer(false)} aria-hidden />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] animate-sheet-in flex-col rounded-t-3xl border-t border-line bg-surface"
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <Logo />
              <IconButton icon={X} label="Fechar menu" onClick={() => setDrawer(false)} />
            </div>
            <div className="scroll-thin flex-1 overflow-y-auto px-3 py-2">
              <NavList onNavigate={() => setDrawer(false)} />
            </div>
            <div className="border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <UserBox />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MobileTab({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors',
          isActive ? 'text-brand' : 'text-muted',
        )
      }
    >
      <item.icon className="size-5" aria-hidden />
      {item.label}
    </NavLink>
  )
}

/** Layout das telas autenticadas. Sem onboarding concluído, leva às boas-vindas. */
export function AppLayout() {
  const { profile } = useFinance()
  if (!profile.onboarded) return <Navigate to="/boas-vindas" replace />
  return (
    <TransactionModalProvider>
      <Shell />
    </TransactionModalProvider>
  )
}
