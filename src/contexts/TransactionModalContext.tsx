import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { TransactionModal, type TransactionDefaults } from '@/components/TransactionModal'
import type { Transaction } from '@/types'
import { todayISO } from '@/utils/date'

interface TransactionModalValue {
  create: (defaults?: TransactionDefaults) => void
  edit: (tx: Transaction) => void
  duplicate: (tx: Transaction) => void
}

interface State {
  /** Muda a cada abertura para o formulário começar limpo. */
  seq: number
  open: boolean
  editing?: Transaction
  defaults?: TransactionDefaults
}

const Context = createContext<TransactionModalValue | null>(null)

/** Um único modal de lançamento para o app todo, aberto de qualquer tela. */
export function TransactionModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ seq: 0, open: false })

  const create = useCallback(
    (defaults?: TransactionDefaults) => setState((s) => ({ seq: s.seq + 1, open: true, defaults })),
    [],
  )
  const edit = useCallback((tx: Transaction) => setState((s) => ({ seq: s.seq + 1, open: true, editing: tx })), [])
  const duplicate = useCallback(
    (tx: Transaction) =>
      create({
        type: tx.type,
        description: tx.description,
        amount_cents: tx.amount_cents,
        category_id: tx.category_id,
        payment_method: tx.payment_method,
        account_id: tx.account_id,
        card_id: tx.card_id,
        notes: tx.notes,
        date: todayISO(),
      }),
    [create],
  )

  const value = useMemo(() => ({ create, edit, duplicate }), [create, edit, duplicate])

  return (
    <Context.Provider value={value}>
      {children}
      <TransactionModal
        key={state.seq}
        open={state.open}
        editing={state.editing}
        defaults={state.defaults}
        onClose={() => setState((s) => ({ ...s, open: false }))}
        onDuplicate={duplicate}
      />
    </Context.Provider>
  )
}

export function useTransactionModal() {
  const ctx = useContext(Context)
  if (!ctx) throw new Error('useTransactionModal precisa estar dentro de TransactionModalProvider')
  return ctx
}
