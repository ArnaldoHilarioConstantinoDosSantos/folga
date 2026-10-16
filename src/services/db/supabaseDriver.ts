import type { SupabaseClient } from '@supabase/supabase-js'
import type { NewRow, Patch, Row, TableName } from '@/types'
import { DATA_TABLES, DataError, type Driver } from './types'

const PAGE = 1000
const WRITE_CHUNK = 500
// Filtros `in (...)` vão na URL; lotes pequenos evitam estourar o tamanho dela.
const ID_CHUNK = 100

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

function toError(error: { message: string; code?: string }): DataError {
  if (error.code === '23505') return new DataError('Já existe um registro igual a este.')
  if (error.code === '23503') return new DataError('Este registro está sendo usado por outros dados.')
  if (error.code === '42501' || error.code === 'PGRST301') {
    return new DataError('Você não tem permissão para esta operação. Entre novamente.')
  }
  if (error.code === '42P01' || error.code === 'PGRST205') {
    return new DataError('Banco de dados não configurado: execute o arquivo supabase/schema.sql no seu projeto.')
  }
  if (/fetch|network/i.test(error.message)) return new DataError('Sem conexão com o servidor. Tente novamente.')
  return new DataError(error.message)
}

export function createSupabaseDriver(client: SupabaseClient): Driver {
  return {
    async list<T extends TableName>(table: T) {
      const rows: Row<T>[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await client
          .from(table)
          .select('*')
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, from + PAGE - 1)
        if (error) throw toError(error)
        rows.push(...(data as Row<T>[]))
        if (data.length < PAGE) return rows
      }
    },

    async insert<T extends TableName>(table: T, rows: NewRow<T>[]) {
      const created: Row<T>[] = []
      for (const part of chunk(rows, WRITE_CHUNK)) {
        const { data, error } = await client.from(table).insert(part).select()
        if (error) throw toError(error)
        created.push(...(data as Row<T>[]))
      }
      return created
    },

    async update<T extends TableName>(table: T, ids: string[], patch: Patch<T>) {
      for (const part of chunk(ids, ID_CHUNK)) {
        const { error } = await client.from(table).update(patch as Record<string, unknown>).in('id', part)
        if (error) throw toError(error)
      }
    },

    async remove(table: TableName, ids: string[]) {
      for (const part of chunk(ids, ID_CHUNK)) {
        const { error } = await client.from(table).delete().in('id', part)
        if (error) throw toError(error)
      }
    },

    async clearAll() {
      // A RLS já restringe ao usuário; o filtro existe porque o PostgREST
      // recusa DELETE sem condição.
      for (const table of DATA_TABLES) {
        const { error } = await client.from(table).delete().not('id', 'is', null)
        if (error) throw toError(error)
      }
    },
  }
}
