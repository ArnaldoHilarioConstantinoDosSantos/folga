import type { ReactNode } from 'react'
import { PiggyBank, ShieldCheck, TrendingUp } from 'lucide-react'
import { Logo } from '@/components/Logo'

const POINTS = [
  { icon: TrendingUp, text: 'Veja para onde seu dinheiro vai, mês a mês.' },
  { icon: PiggyBank, text: 'Saiba quanto pode gastar sem comprometer suas metas.' },
  { icon: ShieldCheck, text: 'Seus dados são só seus, protegidos por conta.' },
]

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-hero p-12 text-hero-ink lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-white/[0.05]" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 -left-20 size-[28rem] rounded-full bg-white/[0.04]" aria-hidden />
        <span className="relative text-2xl font-extrabold tracking-tight">Folga</span>
        <div className="relative max-w-md">
          <h2 className="text-4xl leading-tight font-extrabold tracking-tight">
            Dinheiro organizado é dinheiro que sobra.
          </h2>
          <ul className="mt-10 space-y-5">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-4 text-[15px] font-medium opacity-90">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <Icon className="size-5" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs opacity-60">Organização financeira pessoal</p>
      </aside>

      <main className="flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm animate-rise">
          <Logo className="mb-10 lg:hidden" />
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
          <p className="mt-1.5 mb-8 text-sm text-muted">{subtitle}</p>
          {children}
          {footer && <div className="mt-8 text-center text-sm text-muted">{footer}</div>}
        </div>
      </main>
    </div>
  )
}
