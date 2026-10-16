import { Suspense, lazy } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { Logo } from './components/Logo'
import { Skeleton } from './components/ui/Feedback'
import { useAuth } from './contexts/AuthContext'
import { FinanceProvider } from './contexts/FinanceContext'
import { AppLayout } from './layouts/AppLayout'

const Login = lazy(() => import('./pages/auth/Login'))
const Register = lazy(() => import('./pages/auth/Register'))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Transactions = lazy(() => import('./pages/Transactions'))
const Incomes = lazy(() => import('./pages/Incomes'))
const Expenses = lazy(() => import('./pages/Expenses'))
const FixedExpenses = lazy(() => import('./pages/FixedExpenses'))
const Cards = lazy(() => import('./pages/Cards'))
const CardInvoice = lazy(() => import('./pages/CardInvoice'))
const Installments = lazy(() => import('./pages/Installments'))
const CalendarPage = lazy(() => import('./pages/Calendar'))
const Future = lazy(() => import('./pages/Future'))
const Budget = lazy(() => import('./pages/Budget'))
const Goals = lazy(() => import('./pages/Goals'))
const Accounts = lazy(() => import('./pages/Accounts'))
const Reports = lazy(() => import('./pages/Reports'))
const Categories = lazy(() => import('./pages/Categories'))
const Settings = lazy(() => import('./pages/Settings'))
const NotFound = lazy(() => import('./pages/NotFound'))

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center" aria-busy="true" aria-label="Carregando">
      <Logo className="animate-pulse" />
    </div>
  )
}

function PageFallback() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-64" />
    </div>
  )
}

/** Rotas privadas: sem sessão, manda para o login guardando o destino. */
function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Splash />
  if (!user) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />
  return (
    <FinanceProvider>
      <Outlet />
    </FinanceProvider>
  )
}

/** Login e cadastro: quem já está autenticado vai direto para o Dashboard. */
function PublicOnly() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Splash />
  if (user) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from && from !== '/entrar' ? from : '/'} replace />
  }
  return <Outlet />
}

export default function App() {
  return (
    <Suspense fallback={<Splash />}>
      <Routes>
        <Route element={<PublicOnly />}>
          <Route path="/entrar" element={<Login />} />
          <Route path="/cadastro" element={<Register />} />
          <Route path="/recuperar-senha" element={<ForgotPassword />} />
        </Route>
        <Route path="/redefinir-senha" element={<ResetPassword />} />

        <Route element={<RequireAuth />}>
          <Route path="/boas-vindas" element={<Onboarding />} />
          <Route element={<AppLayout />}>
            <Route
              element={
                <Suspense fallback={<PageFallback />}>
                  <Outlet />
                </Suspense>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="lancamentos" element={<Transactions />} />
              <Route path="receitas" element={<Incomes />} />
              <Route path="despesas" element={<Expenses />} />
              <Route path="gastos-fixos" element={<FixedExpenses />} />
              <Route path="cartoes" element={<Cards />} />
              <Route path="cartoes/:cardId" element={<CardInvoice />} />
              <Route path="parcelamentos" element={<Installments />} />
              <Route path="calendario" element={<CalendarPage />} />
              <Route path="despesas-futuras" element={<Future />} />
              <Route path="orcamento" element={<Budget />} />
              <Route path="metas" element={<Goals />} />
              <Route path="contas" element={<Accounts />} />
              <Route path="relatorios" element={<Reports />} />
              <Route path="categorias" element={<Categories />} />
              <Route path="configuracoes" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}
