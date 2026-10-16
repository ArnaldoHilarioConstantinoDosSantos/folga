import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { tableKey } from '@/contexts/FinanceContext'
import { useToast } from '@/contexts/ToastContext'
import { db } from '@/services/db'
import type { NewRow, Patch, Row, TableName } from '@/types'

const errorMessage = (error: unknown) =>
  error instanceof Error && error.message ? error.message : 'Algo deu errado. Tente novamente.'

/**
 * Escrita de dados para as telas. Toda função mostra o aviso de sucesso ou de
 * erro e devolve `undefined` quando falha — o formulário só fecha se der certo.
 */
export function useDb() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { user } = useAuth()
  const userId = user?.id ?? ''

  return useMemo(() => {
    const invalidate = (tables: TableName[]) =>
      Promise.all(tables.map((t) => queryClient.invalidateQueries({ queryKey: tableKey(userId, t) })))

    async function guard<T>(action: () => Promise<T>, success?: string): Promise<T | undefined> {
      try {
        const result = await action()
        if (success) toast.success(success)
        return result
      } catch (error) {
        toast.error(errorMessage(error))
        return undefined
      }
    }

    return {
      create<T extends TableName>(table: T, row: NewRow<T>, success?: string) {
        return guard(async () => {
          const [created] = await db.insert(table, [row])
          queryClient.setQueryData<Row<T>[]>(tableKey(userId, table), (old) => [...(old ?? []), created])
          return created
        }, success)
      },

      update<T extends TableName>(table: T, id: string, patch: Patch<T>, success?: string) {
        return guard(async () => {
          await db.update(table, [id], patch)
          queryClient.setQueryData<Row<T>[]>(tableKey(userId, table), (old) =>
            (old ?? []).map((row) => (row.id === id ? { ...row, ...patch } : row)),
          )
          return true
        }, success)
      },

      /** Exclusões podem cascatear para outras tabelas, então tudo é recarregado. */
      remove(table: TableName, id: string, success?: string) {
        return guard(async () => {
          await db.remove(table, [id])
          await queryClient.invalidateQueries({ queryKey: ['db', userId] })
          return true
        }, success)
      },

      /** Executa uma operação composta de `services/operations`. */
      run(operation: () => Promise<TableName[]>, success?: string) {
        return guard(async () => {
          await invalidate(await operation())
          return true
        }, success)
      },
    }
  }, [queryClient, toast, userId])
}
