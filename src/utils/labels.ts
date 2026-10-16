import type { AccountType, ColorKey, Frequency, PaymentMethod, TxType } from '@/types'

export const PAYMENT_METHODS: Record<PaymentMethod, string> = {
  pix: 'Pix',
  debit: 'Débito',
  credit: 'Crédito',
  cash: 'Dinheiro',
  boleto: 'Boleto',
  transfer: 'Transferência',
}

export const ACCOUNT_TYPES: Record<AccountType, string> = {
  checking: 'Conta corrente',
  salary: 'Conta salário',
  digital: 'Conta digital',
  wallet: 'Carteira',
  savings: 'Poupança',
  investment: 'Investimentos',
}

export const FREQUENCIES: Record<Frequency, string> = {
  monthly: 'Mensal',
  weekly: 'Semanal',
  yearly: 'Anual',
}

export const TX_TYPES: Record<TxType, string> = {
  income: 'Receita',
  expense: 'Despesa',
}

export const COLOR_KEYS: ColorKey[] = [
  'blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red', 'brown', 'gray',
]

export const COLOR_NAMES: Record<ColorKey, string> = {
  blue: 'Azul',
  orange: 'Laranja',
  aqua: 'Verde-água',
  yellow: 'Amarelo',
  magenta: 'Rosa',
  green: 'Verde',
  violet: 'Violeta',
  red: 'Vermelho',
  brown: 'Marrom',
  gray: 'Cinza',
}

/** Cor de categoria como variável CSS — muda sozinha entre tema claro e escuro. */
export const colorVar = (key: ColorKey | null | undefined) => `var(--cat-${key ?? 'gray'})`

export const softColor = (key: ColorKey | null | undefined, amount = 14) =>
  `color-mix(in srgb, ${colorVar(key)} ${amount}%, transparent)`

export const optionsOf = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }))
