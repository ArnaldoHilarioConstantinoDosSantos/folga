import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { CloudOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Feedback'
import { db } from '@/services/db'
import { bootstrap } from '@/services/operations'
import type { FinanceData, TableName } from '@/types'
import { useAuth } from './AuthContext'

/** Tabela do banco → campo correspondente em `FinanceData`. */
const COLLECTIONS: Array<[TableName, Exclude<keyof FinanceData, 'profile'> | 'profiles']> = [
  ['profiles', 'profiles'],
  ['accounts', 'accounts'],
  ['categories', 'categories'],
  ['transactions', 'transactions'],
  ['recurring_transactions', 'recurring'],
  ['credit_cards', 'cards'],
  ['installments', 'installments'],
  ['budgets', 'budgets'],
  ['financial_goals', 'goals'],
  ['goal_contributions', 'contributions'],
  ['monthly_plans', 'plans'],
  ['transfers', 'transfers'],
  ['notifications', 'notifications'],
]

export const tableKey = (userId: string, table: TableName) => ['db', userId, table] as const

const FinanceContext = createContext<FinanceData | null>(null)

/**
 * Carrega todos os dados do usuário de uma vez e os entrega prontos às telas.
 * Enquanto carrega mostra o esqueleto; se falhar, o erro com "tentar de novo".
 * As telas, portanto, só precisam tratar o estado "sem dados".
 */
export function FinanceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user!.id

  const boot = useQuery({
    queryKey: ['bootstrap', userId],
    queryFn: async () => {
      await bootstrap(user!)
      return true
    },
    staleTime: Infinity,
    gcTime: Infinity,
  })

  const results = useQueries({
    queries: COLLECTIONS.map(([table]) => ({
      queryKey: tableKey(userId, table),
      queryFn: () => db.list(table),
      enabled: boot.isSuccess,
    })),
  })

  const error = boot.error ?? results.find((r) => r.error)?.error ?? null
  const ready = boot.isSuccess && results.every((r) => r.data !== undefined)
  // Uma dependência por coleção (tamanho fixo): o objeto só é refeito quando
  // alguma lista realmente muda.
  const lists = results.map((r) => r.data)

  const data = useMemo<FinanceData | null>(() => {
    if (!ready) return null
    const out: Record<string, unknown> = {}
    COLLECTIONS.forEach(([, field], i) => {
      out[field] = lists[i]
    })
    const profile = (out.profiles as FinanceData['profile'][]).find((p) => p.id === userId)
    if (!profile) return null
    delete out.profiles
    return { ...(out as Omit<FinanceData, 'profile'>), profile }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, userId, ...lists])

  if (error && !data) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-neg-soft text-neg">
          <CloudOff className="size-6" aria-hidden />
        </span>
        <div>
          <h1 className="text-lg font-bold">Não foi possível carregar seus dados</h1>
          <p className="mt-1 max-w-sm text-sm text-muted">{error.message}</p>
        </div>
        <Button
          onClick={() => {
            void queryClient.resetQueries({ queryKey: ['bootstrap', userId] })
            void queryClient.resetQueries({ queryKey: ['db', userId] })
          }}
        >
          Tentar novamente
        </Button>
      </div>
    )
  }

  if (!data) return <LoadingScreen />

  return <FinanceContext.Provider value={data}>{children}</FinanceContext.Provider>
}

function LoadingScreen() {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-6xl space-y-6 p-6" aria-busy="true" aria-label="Carregando seus dados">
      <Skeleton className="h-9 w-56" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 lg:col-span-2" />
        <Skeleton className="h-80" />
      </div>
    </div>
  )
}

export function useFinance(): FinanceData {
  const ctx = useContext(FinanceContext)
  if (!ctx) throw new Error('useFinance precisa estar dentro de FinanceProvider')
  return ctx
}
