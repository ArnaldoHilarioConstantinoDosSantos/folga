import {
  ArrowLeftRight,
  CalendarClock,
  CalendarDays,
  ChartColumn,
  ChartPie,
  CreditCard,
  Layers,
  LayoutDashboard,
  Repeat,
  Settings,
  Tags,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export interface NavGroup {
  title?: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/lancamentos', label: 'Lançamentos', icon: ArrowLeftRight },
      { to: '/receitas', label: 'Receitas', icon: TrendingUp },
      { to: '/despesas', label: 'Despesas', icon: TrendingDown },
    ],
  },
  {
    title: 'Compromissos',
    items: [
      { to: '/gastos-fixos', label: 'Gastos Fixos', icon: Repeat },
      { to: '/cartoes', label: 'Cartões', icon: CreditCard },
      { to: '/parcelamentos', label: 'Parcelamentos', icon: Layers },
      { to: '/calendario', label: 'Calendário', icon: CalendarDays },
      { to: '/despesas-futuras', label: 'Despesas futuras', icon: CalendarClock },
    ],
  },
  {
    title: 'Planejamento',
    items: [
      { to: '/orcamento', label: 'Orçamento', icon: ChartPie },
      { to: '/metas', label: 'Metas', icon: Target },
      { to: '/contas', label: 'Contas e patrimônio', icon: Wallet },
      { to: '/relatorios', label: 'Relatórios', icon: ChartColumn },
    ],
  },
  {
    title: 'Ajustes',
    items: [
      { to: '/categorias', label: 'Categorias', icon: Tags },
      { to: '/configuracoes', label: 'Configurações', icon: Settings },
    ],
  },
]

/** Atalhos da barra inferior no celular; o restante fica em "Mais". */
export const MOBILE_PRIMARY: NavItem[] = [
  { to: '/', label: 'Início', icon: LayoutDashboard },
  { to: '/lancamentos', label: 'Lançamentos', icon: ArrowLeftRight },
  { to: '/orcamento', label: 'Orçamento', icon: ChartPie },
]
