/**
 * Tipos do domínio. Os campos seguem exatamente os nomes das colunas do banco
 * (snake_case), então as linhas do Supabase são usadas sem camada de conversão.
 * Todo valor monetário é um inteiro em centavos (`*_cents`).
 */

export type MonthKey = string // 'YYYY-MM'
export type ISODate = string // 'YYYY-MM-DD'

export type TxType = 'income' | 'expense'
export type PaymentMethod = 'pix' | 'debit' | 'credit' | 'cash' | 'boleto' | 'transfer'
export type Frequency = 'monthly' | 'weekly' | 'yearly'
export type AccountType = 'checking' | 'salary' | 'wallet' | 'digital' | 'savings' | 'investment'
export type GoalKind = 'goal' | 'emergency'
export type ColorKey =
  | 'blue'
  | 'orange'
  | 'aqua'
  | 'yellow'
  | 'magenta'
  | 'green'
  | 'violet'
  | 'red'
  | 'brown'
  | 'gray'

interface Base {
  id: string
  user_id: string
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  full_name: string
  pay_day: number | null
  financial_goal: string | null
  onboarded: boolean
  defaults_seeded: boolean
  created_at: string
  updated_at: string
}

export interface Account extends Base {
  name: string
  type: AccountType
  initial_balance_cents: number
  color: ColorKey
}

export interface Category extends Base {
  name: string
  icon: string
  color: ColorKey
  type: TxType
  parent_id: string | null
}

export interface Transaction extends Base {
  description: string
  amount_cents: number
  type: TxType
  category_id: string | null
  date: ISODate
  payment_method: PaymentMethod
  account_id: string | null
  card_id: string | null
  notes: string | null
  paid: boolean
  recurring_id: string | null
  installment_id: string | null
  installment_number: number | null
  installment_total: number | null
  /** Apenas no cliente: ocorrência futura de um recorrente ainda não gravada. */
  virtual?: boolean
}

export interface Recurring extends Base {
  description: string
  amount_cents: number
  type: TxType
  category_id: string | null
  frequency: Frequency
  /** Dia do mês (mensal e anual). */
  day: number
  /** Dia da semana, 0 = domingo (semanal). */
  weekday: number | null
  /** Mês 1–12 (anual). */
  month: number | null
  payment_method: PaymentMethod
  account_id: string | null
  card_id: string | null
  active: boolean
  start_date: ISODate
  end_date: ISODate | null
  /** Último mês para o qual os lançamentos já foram gerados. */
  generated_until: MonthKey | null
}

export interface CreditCard extends Base {
  name: string
  bank: string
  limit_cents: number
  closing_day: number
  due_day: number
  color: ColorKey
}

export interface Installment extends Base {
  description: string
  total_cents: number
  count: number
  first_date: ISODate
  category_id: string | null
  card_id: string | null
  account_id: string | null
  payment_method: PaymentMethod
  notes: string | null
}

export interface Budget extends Base {
  category_id: string
  limit_cents: number
}

export interface Goal extends Base {
  name: string
  target_cents: number
  target_date: ISODate | null
  icon: string
  color: ColorKey
  kind: GoalKind
}

export interface GoalContribution extends Base {
  goal_id: string
  amount_cents: number
  date: ISODate
  account_id: string | null
  note: string | null
}

export interface PlanAllocation {
  key: string
  label: string
  category_id: string | null
  amount_cents: number
}

export interface MonthlyPlan extends Base {
  month: MonthKey
  expected_income_cents: number
  allocations: PlanAllocation[]
}

export interface Transfer extends Base {
  from_account_id: string
  to_account_id: string
  amount_cents: number
  date: ISODate
  note: string | null
}

export interface NotificationState extends Base {
  key: string
  dismissed_at: string
}

export interface Tables {
  profiles: Profile
  accounts: Account
  categories: Category
  transactions: Transaction
  recurring_transactions: Recurring
  credit_cards: CreditCard
  installments: Installment
  budgets: Budget
  financial_goals: Goal
  goal_contributions: GoalContribution
  monthly_plans: MonthlyPlan
  transfers: Transfer
  notifications: NotificationState
}

export type TableName = keyof Tables
export type Row<T extends TableName> = Tables[T]
export type NewRow<T extends TableName> = Omit<
  Row<T>,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'virtual'
> & { id?: string }
export type Patch<T extends TableName> = Partial<Omit<NewRow<T>, 'id'>>

/** Todos os dados do usuário, carregados uma vez e usados pelos cálculos. */
export interface FinanceData {
  profile: Profile
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  recurring: Recurring[]
  cards: CreditCard[]
  installments: Installment[]
  budgets: Budget[]
  goals: Goal[]
  contributions: GoalContribution[]
  plans: MonthlyPlan[]
  transfers: Transfer[]
  notifications: NotificationState[]
}
