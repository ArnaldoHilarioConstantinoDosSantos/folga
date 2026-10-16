import type {
  ColorKey,
  Frequency,
  ISODate,
  NewRow,
  PaymentMethod,
  PlanAllocation,
  Recurring,
  TxType,
} from '@/types'
import {
  addMonths,
  addMonthsToDate,
  dateInMonth,
  lastMonths,
  monthOf,
  startOfMonth,
} from '@/utils/date'
import { invoiceDueDate, invoiceKeyOf } from '@/utils/finance'
import { splitInstallments } from '@/utils/money'
import { occurrencesInMonth, recurringToTx } from '@/utils/recurring'
import type { Driver } from './db'

const uid = () => crypto.randomUUID()

/* ------------------------------------------------------------------ */
/* Categorias padrão                                                   */
/* ------------------------------------------------------------------ */

type CategorySeed = [name: string, icon: string, color: ColorKey, children?: Array<[string, string]>]

const EXPENSE_CATEGORIES: CategorySeed[] = [
  ['Moradia', 'house', 'blue', [
    ['Condomínio', 'building'], ['Energia', 'zap'], ['Água', 'droplets'], ['Internet', 'wifi'],
    ['Aluguel/Financiamento', 'key'], ['Manutenção', 'wrench'],
  ]],
  ['Alimentação', 'utensils', 'orange', [
    ['Supermercado', 'cart'], ['Restaurante', 'utensils'], ['Delivery', 'bike'],
  ]],
  ['Transporte', 'car', 'violet', [
    ['Combustível', 'fuel'], ['Uber/99', 'taxi'], ['Manutenção', 'wrench'], ['Seguro', 'shield'],
    ['IPVA', 'file'], ['Estacionamento', 'pin'],
  ]],
  ['Saúde', 'heart', 'red', [['Medicamentos', 'pill'], ['Consultas', 'stethoscope'], ['Academia', 'dumbbell']]],
  ['Lazer', 'party', 'magenta', [
    ['Cinema', 'film'], ['Jogos', 'gamepad'], ['Viagens', 'plane'], ['Restaurantes', 'wine'], ['Eventos', 'ticket'],
  ]],
  ['Assinaturas', 'tv', 'yellow', [
    ['Netflix', 'tv'], ['Spotify', 'music'], ['Amazon', 'package'], ['Serviços digitais', 'cloud'],
  ]],
  ['Compras', 'bag', 'brown', [['Roupas', 'shirt'], ['Eletrônicos', 'smartphone'], ['Casa', 'sofa'], ['Outros', 'dots']]],
  ['Investimentos', 'trending', 'green'],
  ['Educação', 'graduation', 'aqua'],
  ['Outros', 'dots', 'gray'],
]

const INCOME_CATEGORIES: CategorySeed[] = [
  ['Salário', 'briefcase', 'green'],
  ['Renda extra', 'coins', 'aqua'],
  ['Outras receitas', 'banknote', 'gray'],
]

type CategoryRow = NewRow<'categories'> & { id: string }

export function buildDefaultCategories(): CategoryRow[] {
  const rows: CategoryRow[] = []
  const add = (seeds: CategorySeed[], type: TxType) => {
    for (const [name, icon, color, children] of seeds) {
      const id = uid()
      rows.push({ id, name, icon, color, type, parent_id: null })
      for (const [childName, childIcon] of children ?? []) {
        rows.push({ id: uid(), name: childName, icon: childIcon, color, type, parent_id: id })
      }
    }
  }
  add(EXPENSE_CATEGORIES, 'expense')
  add(INCOME_CATEGORIES, 'income')
  return rows
}

/* ------------------------------------------------------------------ */
/* Dados de exemplo                                                    */
/* ------------------------------------------------------------------ */

/** Gerador pseudoaleatório com semente: os dados de exemplo saem sempre iguais. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Preenche a conta com sete meses de dados fictícios (seis fechados + o atual),
 * passando pela mesma interface de dados usada pelo resto do app.
 */
export async function seedDemoData(db: Driver, today: ISODate): Promise<void> {
  const rng = mulberry32(8000)
  const vary = (cents: number) => Math.round((cents * (0.82 + rng() * 0.36)) / 100) * 100 + Math.floor(rng() * 10) * 10
  const current = monthOf(today)
  const months = lastMonths(current, 7)
  const firstDay = startOfMonth(months[0])

  const categories = buildDefaultCategories()
  const cat = (root: string, child?: string): string => {
    const parent = categories.find((c) => c.name === root && !c.parent_id)!
    return child ? categories.find((c) => c.name === child && c.parent_id === parent.id)!.id : parent.id
  }

  const checking = uid()
  const digital = uid()
  const wallet = uid()
  const investments = uid()
  const accounts: NewRow<'accounts'>[] = [
    { id: checking, name: 'Conta corrente', type: 'checking', initial_balance_cents: 320_000, color: 'blue' },
    { id: digital, name: 'Conta digital', type: 'digital', initial_balance_cents: 80_000, color: 'violet' },
    { id: wallet, name: 'Carteira', type: 'wallet', initial_balance_cents: 15_000, color: 'brown' },
    { id: investments, name: 'Investimentos', type: 'investment', initial_balance_cents: 1_500_000, color: 'green' },
  ]

  const nubank = { id: uid(), name: 'Nubank', bank: 'Nu Pagamentos', limit_cents: 800_000, closing_day: 13, due_day: 20, color: 'violet' as ColorKey }
  const inter = { id: uid(), name: 'Inter', bank: 'Banco Inter', limit_cents: 800_000, closing_day: 28, due_day: 5, color: 'orange' as ColorKey }
  const cards = [nubank, inter]

  /* Recorrentes: renda mensal e gastos fixos */
  type RecSeed = {
    description: string
    amount: number
    type?: TxType
    category: string
    day: number
    method: PaymentMethod
    account?: string
    card?: string
    frequency?: Frequency
    weekday?: number
    month?: number
  }
  const recSeeds: RecSeed[] = [
    { description: 'Salário', amount: 700_000, type: 'income', category: cat('Salário'), day: 1, method: 'transfer', account: checking },
    { description: 'Renda extra', amount: 100_000, type: 'income', category: cat('Renda extra'), day: 15, method: 'pix', account: checking },
    { description: 'Aluguel', amount: 105_000, category: cat('Moradia', 'Aluguel/Financiamento'), day: 5, method: 'boleto', account: checking },
    { description: 'Condomínio', amount: 45_000, category: cat('Moradia', 'Condomínio'), day: 10, method: 'boleto', account: checking },
    { description: 'Energia', amount: 13_000, category: cat('Moradia', 'Energia'), day: 12, method: 'boleto', account: checking },
    { description: 'Água', amount: 5_000, category: cat('Moradia', 'Água'), day: 12, method: 'boleto', account: checking },
    { description: 'Internet', amount: 12_000, category: cat('Moradia', 'Internet'), day: 15, method: 'debit', account: checking },
    { description: 'Investimento mensal', amount: 100_000, category: cat('Investimentos'), day: 6, method: 'transfer', account: checking },
    { description: 'Academia', amount: 11_000, category: cat('Saúde', 'Academia'), day: 7, method: 'debit', account: checking },
    { description: 'Seguro do carro', amount: 18_000, category: cat('Transporte', 'Seguro'), day: 22, method: 'debit', account: checking },
    { description: 'Netflix', amount: 3_990, category: cat('Assinaturas', 'Netflix'), day: 20, method: 'credit', card: nubank.id },
    { description: 'Spotify', amount: 2_190, category: cat('Assinaturas', 'Spotify'), day: 8, method: 'credit', card: nubank.id },
    { description: 'Amazon Prime', amount: 1_990, category: cat('Assinaturas', 'Amazon'), day: 14, method: 'credit', card: nubank.id },
    { description: 'Armazenamento na nuvem', amount: 9_830, category: cat('Assinaturas', 'Serviços digitais'), day: 18, method: 'credit', card: nubank.id },
    { description: 'Feira da semana', amount: 6_000, category: cat('Alimentação', 'Supermercado'), day: 1, method: 'pix', account: checking, frequency: 'weekly', weekday: 6 },
    { description: 'IPVA', amount: 180_000, category: cat('Transporte', 'IPVA'), day: 20, method: 'boleto', account: checking, frequency: 'yearly', month: 1 },
  ]
  const recurring = recSeeds.map(
    (r): Recurring => ({
      id: uid(),
      user_id: '',
      created_at: '',
      updated_at: '',
      description: r.description,
      amount_cents: r.amount,
      type: r.type ?? 'expense',
      category_id: r.category,
      frequency: r.frequency ?? 'monthly',
      day: r.day,
      weekday: r.weekday ?? null,
      month: r.month ?? null,
      payment_method: r.method,
      account_id: r.account ?? null,
      card_id: r.card ?? null,
      active: true,
      start_date: firstDay,
      end_date: null,
      generated_until: current,
    }),
  )

  const transactions: NewRow<'transactions'>[] = []
  const cardOf = (id: string | null) => cards.find((c) => c.id === id)
  /** Compra no cartão só fica paga quando a fatura dela já venceu. */
  const settle = (tx: NewRow<'transactions'>): NewRow<'transactions'> => {
    const card = cardOf(tx.card_id)
    if (!card) return { ...tx, paid: tx.date <= today }
    const paid = invoiceDueDate(invoiceKeyOf(tx.date, card.closing_day), card) < today
    return { ...tx, paid, account_id: paid ? checking : null }
  }

  for (const month of months) {
    for (const rec of recurring) {
      for (const date of occurrencesInMonth(rec, month)) {
        const base = recurringToTx(rec, date)
        const variable = ['Energia', 'Água'].includes(rec.description)
        transactions.push(settle({ ...base, amount_cents: variable ? vary(base.amount_cents) : base.amount_cents }))
      }
    }
  }

  /* Gastos variáveis do dia a dia */
  type Spend = [description: string, category: string, base: number, day: number, method: PaymentMethod, source: string]
  const spending: Spend[] = [
    ['Supermercado Pão de Açúcar', cat('Alimentação', 'Supermercado'), 24_000, 2, 'debit', checking],
    ['Supermercado Atacadão', cat('Alimentação', 'Supermercado'), 21_000, 16, 'debit', checking],
    ['Almoço no restaurante', cat('Alimentação', 'Restaurante'), 6_800, 9, 'credit', nubank.id],
    ['Jantar fora', cat('Alimentação', 'Restaurante'), 8_500, 23, 'credit', nubank.id],
    ['iFood', cat('Alimentação', 'Delivery'), 4_200, 4, 'credit', nubank.id],
    ['iFood', cat('Alimentação', 'Delivery'), 3_600, 13, 'credit', nubank.id],
    ['Rappi', cat('Alimentação', 'Delivery'), 3_900, 26, 'credit', nubank.id],
    ['Posto Shell', cat('Transporte', 'Combustível'), 16_000, 3, 'credit', nubank.id],
    ['Posto Ipiranga', cat('Transporte', 'Combustível'), 15_000, 19, 'credit', nubank.id],
    ['Uber', cat('Transporte', 'Uber/99'), 2_600, 1, 'pix', digital],
    ['99', cat('Transporte', 'Uber/99'), 2_200, 11, 'pix', digital],
    ['Uber', cat('Transporte', 'Uber/99'), 3_100, 21, 'pix', digital],
    ['Estacionamento', cat('Transporte', 'Estacionamento'), 2_000, 17, 'cash', wallet],
    ['Cinema', cat('Lazer', 'Cinema'), 6_400, 14, 'credit', nubank.id],
    ['Jogo na Steam', cat('Lazer', 'Jogos'), 8_000, 8, 'credit', inter.id],
    ['Bar com amigos', cat('Lazer', 'Restaurantes'), 12_000, 24, 'pix', digital],
    ['Show', cat('Lazer', 'Eventos'), 15_000, 27, 'credit', nubank.id],
    ['Farmácia', cat('Saúde', 'Medicamentos'), 7_500, 10, 'debit', checking],
    ['Roupas', cat('Compras', 'Roupas'), 17_000, 18, 'credit', nubank.id],
    ['Itens para casa', cat('Compras', 'Casa'), 11_000, 25, 'pix', digital],
    ['Presente', cat('Outros'), 9_000, 22, 'pix', checking],
  ]
  for (const month of months) {
    for (const [description, category, base, day, method, source] of spending) {
      const date = dateInMonth(month, day)
      const amount = vary(base)
      if (date > today) continue
      const onCard = method === 'credit'
      transactions.push(
        settle({
          description,
          amount_cents: amount,
          type: 'expense',
          category_id: category,
          date,
          payment_method: method,
          account_id: onCard ? null : source,
          card_id: onCard ? source : null,
          notes: null,
          paid: true,
          recurring_id: null,
          installment_id: null,
          installment_number: null,
          installment_total: null,
        }),
      )
    }
  }

  /* Parcelamentos */
  type InstSeed = [description: string, total: number, count: number, first: ISODate, category: string, card: string | null]
  const instSeeds: InstSeed[] = [
    ['Geladeira', 360_000, 12, dateInMonth(months[3], 10), cat('Compras', 'Casa'), nubank.id],
    ['Notebook', 420_000, 10, dateInMonth(months[1], 18), cat('Compras', 'Eletrônicos'), inter.id],
    ['Curso de inglês', 240_000, 12, dateInMonth(months[2], 12), cat('Educação'), null],
  ]
  const installments: NewRow<'installments'>[] = []
  for (const [description, total, count, first, category, card] of instSeeds) {
    const id = uid()
    installments.push({
      id,
      description,
      total_cents: total,
      count,
      first_date: first,
      category_id: category,
      card_id: card,
      account_id: card ? null : checking,
      payment_method: card ? 'credit' : 'boleto',
      notes: null,
    })
    splitInstallments(total, count).forEach((amount, i) => {
      transactions.push(
        settle({
          description,
          amount_cents: amount,
          type: 'expense',
          category_id: category,
          date: addMonthsToDate(first, i),
          payment_method: card ? 'credit' : 'boleto',
          account_id: card ? null : checking,
          card_id: card,
          notes: null,
          paid: false,
          recurring_id: null,
          installment_id: id,
          installment_number: i + 1,
          installment_total: count,
        }),
      )
    })
  }

  /* Metas e aportes */
  const reserve = uid()
  const trip = uid()
  const goals: NewRow<'financial_goals'>[] = [
    { id: reserve, name: 'Reserva de emergência', target_cents: 3_000_000, target_date: null, icon: 'shield', color: 'green', kind: 'emergency' },
    { id: trip, name: 'Viagem', target_cents: 1_000_000, target_date: dateInMonth(addMonths(current, 6), 1), icon: 'plane', color: 'blue', kind: 'goal' },
  ]
  const contributions: NewRow<'goal_contributions'>[] = [
    { goal_id: reserve, amount_cents: 900_000, date: firstDay, account_id: null, note: 'Saldo inicial' },
    { goal_id: trip, amount_cents: 60_000, date: firstDay, account_id: null, note: 'Saldo inicial' },
  ]
  months.forEach((month, i) => {
    const date = dateInMonth(month, 6)
    if (date > today) return
    contributions.push({ goal_id: reserve, amount_cents: 50_000, date, account_id: checking, note: null })
    contributions.push({ goal_id: trip, amount_cents: i < 3 ? 30_000 : 100_000, date, account_id: checking, note: null })
  })

  /* Transferências entre contas (não contam como receita nem despesa) */
  const transfers: NewRow<'transfers'>[] = months.flatMap((month) => {
    const date = dateInMonth(month, 2)
    if (date > today) return []
    return [
      { from_account_id: checking, to_account_id: digital, amount_cents: 35_000, date, note: 'Gastos do mês' },
      { from_account_id: checking, to_account_id: wallet, amount_cents: 5_000, date, note: 'Dinheiro em espécie' },
    ]
  })

  const budgets: NewRow<'budgets'>[] = [
    { category_id: cat('Alimentação'), limit_cents: 100_000 },
    { category_id: cat('Transporte'), limit_cents: 70_000 },
    { category_id: cat('Lazer'), limit_cents: 50_000 },
    { category_id: cat('Compras'), limit_cents: 80_000 },
    { category_id: cat('Assinaturas'), limit_cents: 20_000 },
    { category_id: cat('Saúde'), limit_cents: 25_000 },
  ]

  const allocations = (): PlanAllocation[] => [
    { key: uid(), label: 'Moradia', category_id: cat('Moradia'), amount_cents: 200_000 },
    { key: uid(), label: 'Alimentação', category_id: cat('Alimentação'), amount_cents: 100_000 },
    { key: uid(), label: 'Transporte', category_id: cat('Transporte'), amount_cents: 70_000 },
    { key: uid(), label: 'Lazer', category_id: cat('Lazer'), amount_cents: 50_000 },
    { key: uid(), label: 'Investimentos', category_id: cat('Investimentos'), amount_cents: 100_000 },
    { key: uid(), label: 'Reserva', category_id: null, amount_cents: 100_000 },
    { key: uid(), label: 'Outros', category_id: cat('Outros'), amount_cents: 80_000 },
    { key: uid(), label: 'Livre', category_id: null, amount_cents: 100_000 },
  ]
  const plans: NewRow<'monthly_plans'>[] = [addMonths(current, -1), current].map((month) => ({
    month,
    expected_income_cents: 800_000,
    allocations: allocations(),
  }))

  // Ordem respeita as chaves estrangeiras.
  await db.insert('categories', categories)
  await db.insert('accounts', accounts)
  await db.insert('credit_cards', cards)
  await db.insert('financial_goals', goals)
  await db.insert(
    'recurring_transactions',
    recurring.map(({ user_id: _u, created_at: _c, updated_at: _up, ...row }) => row),
  )
  await db.insert('installments', installments)
  await db.insert('transactions', transactions)
  await db.insert('goal_contributions', contributions)
  await db.insert('transfers', transfers)
  await db.insert('budgets', budgets)
  await db.insert('monthly_plans', plans)
}
