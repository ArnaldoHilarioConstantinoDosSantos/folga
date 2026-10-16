import type { NewRow, Patch, Row, TableName, Tables } from '@/types'
import { DATA_TABLES, DataError, type Driver } from './types'

const STORAGE_KEY = 'folga:db:v1'
export const LOCAL_USER_ID = 'local-user'

type Store = { [T in TableName]?: Tables[T][] }
type Relation = [table: TableName, column: string]

/** Espelha as regras `on delete` do schema SQL para o modo demonstração. */
const CASCADE: Partial<Record<TableName, Relation[]>> = {
  categories: [['categories', 'parent_id'], ['budgets', 'category_id']],
  installments: [['transactions', 'installment_id']],
  financial_goals: [['goal_contributions', 'goal_id']],
  accounts: [['transfers', 'from_account_id'], ['transfers', 'to_account_id']],
}

const SET_NULL: Partial<Record<TableName, Relation[]>> = {
  categories: [
    ['transactions', 'category_id'],
    ['recurring_transactions', 'category_id'],
    ['installments', 'category_id'],
  ],
  accounts: [
    ['transactions', 'account_id'],
    ['recurring_transactions', 'account_id'],
    ['installments', 'account_id'],
    ['goal_contributions', 'account_id'],
  ],
  credit_cards: [
    ['transactions', 'card_id'],
    ['recurring_transactions', 'card_id'],
    ['installments', 'card_id'],
  ],
  recurring_transactions: [['transactions', 'recurring_id']],
}

type AnyRow = Record<string, unknown> & { id: string }

function read(): Store {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Store
  } catch {
    return {}
  }
}

function write(store: Store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    throw new DataError('Não foi possível salvar: o armazenamento do navegador está cheio ou bloqueado.')
  }
}

const rowsOf = (store: Store, table: TableName) => (store[table] ?? []) as unknown as AnyRow[]
const setRows = (store: Store, table: TableName, rows: AnyRow[]) => {
  ;(store as Record<string, unknown>)[table] = rows
}

function removeFrom(store: Store, table: TableName, ids: Set<string>) {
  if (ids.size === 0) return
  setRows(store, table, rowsOf(store, table).filter((r) => !ids.has(r.id)))
  for (const [child, column] of SET_NULL[table] ?? []) {
    setRows(
      store,
      child,
      rowsOf(store, child).map((r) => (ids.has(r[column] as string) ? { ...r, [column]: null } : r)),
    )
  }
  for (const [child, column] of CASCADE[table] ?? []) {
    const childIds = new Set(
      rowsOf(store, child)
        .filter((r) => ids.has(r[column] as string))
        .map((r) => r.id),
    )
    removeFrom(store, child, childIds)
  }
}

/** Banco de demonstração: mesma interface do Supabase, gravando no localStorage. */
export function createLocalDriver(): Driver {
  return {
    async list<T extends TableName>(table: T) {
      return rowsOf(read(), table) as unknown as Row<T>[]
    },

    async insert<T extends TableName>(table: T, rows: NewRow<T>[]) {
      const store = read()
      const now = new Date().toISOString()
      const created = rows.map((row) => ({
        ...row,
        id: row.id ?? crypto.randomUUID(),
        ...(table === 'profiles' ? {} : { user_id: LOCAL_USER_ID }),
        created_at: now,
        updated_at: now,
      })) as unknown as AnyRow[]
      setRows(store, table, [...rowsOf(store, table), ...created])
      write(store)
      return created as unknown as Row<T>[]
    },

    async update<T extends TableName>(table: T, ids: string[], patch: Patch<T>) {
      const store = read()
      const target = new Set(ids)
      const now = new Date().toISOString()
      setRows(
        store,
        table,
        rowsOf(store, table).map((r) => (target.has(r.id) ? { ...r, ...patch, updated_at: now } : r)),
      )
      write(store)
    },

    async remove(table: TableName, ids: string[]) {
      const store = read()
      removeFrom(store, table, new Set(ids))
      write(store)
    },

    async clearAll() {
      const store = read()
      for (const table of DATA_TABLES) delete store[table]
      write(store)
    },
  }
}
