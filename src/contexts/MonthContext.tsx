import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { MonthKey } from '@/types'
import { addMonths, currentMonth } from '@/utils/date'

interface MonthValue {
  month: MonthKey
  setMonth: (month: MonthKey) => void
  previous: () => void
  next: () => void
  isCurrent: boolean
}

const MonthContext = createContext<MonthValue | null>(null)

/** Mês selecionado, compartilhado entre as telas para a navegação ser contínua. */
export function MonthProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState<MonthKey>(currentMonth)
  const value = useMemo<MonthValue>(
    () => ({
      month,
      setMonth,
      previous: () => setMonth((m) => addMonths(m, -1)),
      next: () => setMonth((m) => addMonths(m, 1)),
      isCurrent: month === currentMonth(),
    }),
    [month],
  )
  return <MonthContext.Provider value={value}>{children}</MonthContext.Provider>
}

export function useMonth() {
  const ctx = useContext(MonthContext)
  if (!ctx) throw new Error('useMonth precisa estar dentro de MonthProvider')
  return ctx
}
