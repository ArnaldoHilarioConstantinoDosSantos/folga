import type { NewRow, Patch, Row, TableName } from '@/types'

/**
 * Contrato de acesso a dados. O app inteiro fala só com esta interface; a
 * implementação (Supabase ou armazenamento local) é escolhida em `./index`.
 */
export interface Driver {
  list<T extends TableName>(table: T): Promise<Row<T>[]>
  insert<T extends TableName>(table: T, rows: NewRow<T>[]): Promise<Row<T>[]>
  update<T extends TableName>(table: T, ids: string[], patch: Patch<T>): Promise<void>
  remove(table: TableName, ids: string[]): Promise<void>
  /** Apaga todos os dados do usuário, mantendo apenas o perfil. */
  clearAll(): Promise<void>
}

/** Tabelas de dados (tudo menos o perfil), em ordem segura para exclusão. */
export const DATA_TABLES: Exclude<TableName, 'profiles'>[] = [
  'goal_contributions',
  'transfers',
  'transactions',
  'installments',
  'recurring_transactions',
  'budgets',
  'monthly_plans',
  'notifications',
  'financial_goals',
  'credit_cards',
  'accounts',
  'categories',
]

export class DataError extends Error {}
