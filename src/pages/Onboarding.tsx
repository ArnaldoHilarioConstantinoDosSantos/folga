import { useState, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Button, IconButton } from '@/components/ui/Button'
import { Field, Input, MoneyInput } from '@/components/ui/Form'
import { useAuth } from '@/contexts/AuthContext'
import { useFinance } from '@/contexts/FinanceContext'
import { useDb } from '@/hooks/useDb'
import { cn } from '@/lib/cn'
import { completeOnboarding, type OnboardingAnswers } from '@/services/operations'
import type { AccountType } from '@/types'
import { ACCOUNT_TYPES } from '@/utils/labels'
import { formatBRL } from '@/utils/money'

const STEPS = ['Renda', 'Contas', 'Cartões', 'Gastos fixos', 'Objetivo'] as const

const ACCOUNT_CHOICES: AccountType[] = ['checking', 'salary', 'digital', 'wallet', 'savings', 'investment']

/** Sugestões de gastos fixos: [descrição, categoria principal, subcategoria]. */
const FIXED_PRESETS: Array<[string, string, string?]> = [
  ['Aluguel', 'Moradia', 'Aluguel/Financiamento'],
  ['Condomínio', 'Moradia', 'Condomínio'],
  ['Energia', 'Moradia', 'Energia'],
  ['Água', 'Moradia', 'Água'],
  ['Internet', 'Moradia', 'Internet'],
  ['Academia', 'Saúde', 'Academia'],
  ['Streaming', 'Assinaturas'],
  ['Seguro do carro', 'Transporte', 'Seguro'],
  ['Escola ou curso', 'Educação'],
]

const GOALS = [
  { id: 'reserve', label: 'Montar minha reserva de emergência', needsTarget: true, emergency: true, name: 'Reserva de emergência' },
  { id: 'dream', label: 'Juntar para um objetivo (viagem, casa, carro…)', needsTarget: true, emergency: false, name: '' },
  { id: 'debt', label: 'Sair das dívidas', needsTarget: false, emergency: false, name: '' },
  { id: 'invest', label: 'Investir mais todo mês', needsTarget: false, emergency: false, name: '' },
  { id: 'organize', label: 'Só organizar meus gastos', needsTarget: false, emergency: false, name: '' },
] as const

interface AccountDraft { type: AccountType; name: string; balance: number }
interface CardDraft { key: string; name: string; limit: number; closing: string; due: string }
interface FixedDraft { key: string; description: string; amount: number; day: string; categoryId: string | null }

const validDay = (value: string) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 31

export default function Onboarding() {
  const { profile, categories } = useFinance()
  const { user } = useAuth()
  const db = useDb()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState(profile.full_name || user?.name || '')
  const [income, setIncome] = useState(0)
  const [extra, setExtra] = useState(0)
  const [payDay, setPayDay] = useState('5')
  const [accounts, setAccounts] = useState<AccountDraft[]>([
    { type: 'checking', name: ACCOUNT_TYPES.checking, balance: 0 },
  ])
  const [hasCards, setHasCards] = useState<boolean | null>(null)
  const [cards, setCards] = useState<CardDraft[]>([])
  const [fixed, setFixed] = useState<FixedDraft[]>([])
  const [goalId, setGoalId] = useState<(typeof GOALS)[number]['id']>('reserve')
  const [goalName, setGoalName] = useState('')
  const [goalTarget, setGoalTarget] = useState(0)

  if (profile.onboarded) return <Navigate to="/" replace />

  const goal = GOALS.find((g) => g.id === goalId)!

  const categoryOf = (root: string, child?: string) => {
    const parent = categories.find((c) => c.name === root && !c.parent_id && c.type === 'expense')
    if (!parent) return null
    return categories.find((c) => c.name === child && c.parent_id === parent.id)?.id ?? parent.id
  }

  const toggleAccount = (type: AccountType) =>
    setAccounts((list) =>
      list.some((a) => a.type === type)
        ? list.filter((a) => a.type !== type)
        : [...list, { type, name: ACCOUNT_TYPES[type], balance: 0 }],
    )

  const togglePreset = ([description, root, child]: (typeof FIXED_PRESETS)[number]) =>
    setFixed((list) =>
      list.some((f) => f.description === description)
        ? list.filter((f) => f.description !== description)
        : [...list, { key: crypto.randomUUID(), description, amount: 0, day: '10', categoryId: categoryOf(root, child) }],
    )

  const addCard = () =>
    setCards((list) => [...list, { key: crypto.randomUUID(), name: '', limit: 0, closing: '25', due: '5' }])

  /** Valida o passo atual; devolve a mensagem de erro, se houver. */
  const check = (): string | null => {
    if (step === 0) {
      if (!name.trim()) return 'Diga como podemos te chamar.'
      if (income <= 0) return 'Informe sua renda mensal.'
      if (!validDay(payDay)) return 'O dia de recebimento precisa estar entre 1 e 31.'
    }
    if (step === 1) {
      if (accounts.length === 0) return 'Escolha pelo menos uma conta.'
      if (accounts.some((a) => !a.name.trim())) return 'Dê um nome a cada conta.'
    }
    if (step === 2) {
      if (hasCards === null) return 'Responda se você possui cartões.'
      if (hasCards) {
        if (cards.length === 0) return 'Adicione um cartão ou marque "Não".'
        if (cards.some((c) => !c.name.trim() || c.limit <= 0)) return 'Preencha nome e limite de cada cartão.'
        if (cards.some((c) => !validDay(c.closing) || !validDay(c.due))) return 'Use dias entre 1 e 31 nos cartões.'
      }
    }
    if (step === 3) {
      if (fixed.some((f) => !f.description.trim())) return 'Dê uma descrição a cada gasto fixo.'
      if (fixed.some((f) => f.amount <= 0)) return 'Informe o valor de cada gasto fixo (ou remova-o).'
      if (fixed.some((f) => !validDay(f.day))) return 'Use dias entre 1 e 31 nos gastos fixos.'
    }
    if (step === 4 && goal.needsTarget) {
      if (!goal.emergency && !goalName.trim()) return 'Dê um nome ao seu objetivo.'
      if (goalTarget <= 0) return 'Informe quanto quer juntar.'
    }
    return null
  }

  const finish = async () => {
    const answers: OnboardingAnswers = {
      name: name.trim(),
      incomeCents: income,
      extraIncomeCents: extra,
      payDay: Number(payDay),
      accounts: accounts.map((a) => ({ name: a.name.trim(), type: a.type, balanceCents: a.balance })),
      cards: hasCards
        ? cards.map((c) => ({ name: c.name.trim(), limitCents: c.limit, closingDay: Number(c.closing), dueDay: Number(c.due) }))
        : [],
      fixed: fixed.map((f) => ({
        description: f.description.trim(),
        amountCents: f.amount,
        day: Number(f.day),
        categoryId: f.categoryId,
      })),
      goal: goal.needsTarget
        ? { label: goal.label, name: goal.emergency ? goal.name : goalName.trim(), targetCents: goalTarget, emergency: goal.emergency }
        : { label: goal.label, name: '', targetCents: 0, emergency: false },
    }
    setSaving(true)
    const ok = await db.run(
      () => completeOnboarding(profile.id, answers),
      'Tudo pronto! Montamos seu primeiro planejamento.',
    )
    setSaving(false)
    if (ok) navigate('/', { replace: true })
  }

  const next = () => {
    const problem = check()
    setError(problem)
    if (problem) return
    if (step === STEPS.length - 1) void finish()
    else setStep((s) => s + 1)
  }

  const chip = (selected: boolean) =>
    cn(
      'flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors',
      selected ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-ink-2 hover:bg-surface-2',
    )

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 py-8">
      <Logo />

      <ol className="mt-8 mb-8 flex gap-2" aria-label="Etapas">
        {STEPS.map((label, i) => (
          <li key={label} className="flex-1" aria-current={i === step ? 'step' : undefined}>
            <div className={cn('h-1.5 rounded-full transition-colors', i <= step ? 'bg-brand' : 'bg-line')} />
            <span className={cn('mt-2 hidden text-xs font-semibold sm:block', i === step ? 'text-ink' : 'text-muted')}>
              {label}
            </span>
          </li>
        ))}
      </ol>

      <div key={step} className="flex-1 animate-rise">
        {step === 0 && (
          <Step title="Vamos começar pela sua renda" subtitle="Com ela calculamos percentuais, previsões e o seu primeiro planejamento.">
            <Field label="Como podemos te chamar?">
              {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="h-12" />}
            </Field>
            <Field label="Qual sua renda mensal?" hint="Salário líquido, o que cai na conta.">
              {(id) => <MoneyInput id={id} size="lg" value={income} onChange={setIncome} />}
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Renda extra por mês" hint="Opcional: freelas, aluguéis…">
                {(id) => <MoneyInput id={id} value={extra} onChange={setExtra} />}
              </Field>
              <Field label="Qual dia normalmente recebe?">
                {(id) => (
                  <Input id={id} type="number" inputMode="numeric" min={1} max={31} value={payDay} onChange={(e) => setPayDay(e.target.value)} />
                )}
              </Field>
            </div>
          </Step>
        )}

        {step === 1 && (
          <Step title="Quais contas você utiliza?" subtitle="Marque onde você guarda dinheiro e informe o saldo de hoje.">
            <div className="flex flex-wrap gap-2">
              {ACCOUNT_CHOICES.map((type) => {
                const selected = accounts.some((a) => a.type === type)
                return (
                  <button key={type} type="button" aria-pressed={selected} onClick={() => toggleAccount(type)} className={chip(selected)}>
                    {selected && <Check className="size-4" aria-hidden />}
                    {ACCOUNT_TYPES[type]}
                  </button>
                )
              })}
            </div>
            <ul className="space-y-3">
              {accounts.map((account) => (
                <li key={account.type} className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2">
                  <Field label="Nome">
                    {(id) => (
                      <Input
                        id={id}
                        value={account.name}
                        maxLength={60}
                        onChange={(e) =>
                          setAccounts((list) => list.map((a) => (a.type === account.type ? { ...a, name: e.target.value } : a)))
                        }
                      />
                    )}
                  </Field>
                  <Field label="Saldo atual">
                    {(id) => (
                      <MoneyInput
                        id={id}
                        value={account.balance}
                        onChange={(v) =>
                          setAccounts((list) => list.map((a) => (a.type === account.type ? { ...a, balance: v } : a)))
                        }
                      />
                    )}
                  </Field>
                </li>
              ))}
            </ul>
          </Step>
        )}

        {step === 2 && (
          <Step title="Possui cartões de crédito?" subtitle="Com o limite e as datas, acompanhamos suas faturas.">
            <div className="flex gap-2">
              <button
                type="button"
                aria-pressed={hasCards === true}
                className={chip(hasCards === true)}
                onClick={() => {
                  setHasCards(true)
                  if (cards.length === 0) addCard()
                }}
              >
                Sim
              </button>
              <button type="button" aria-pressed={hasCards === false} className={chip(hasCards === false)} onClick={() => setHasCards(false)}>
                Não
              </button>
            </div>
            {hasCards && (
              <>
                <ul className="space-y-3">
                  {cards.map((card) => {
                    const patch = (change: Partial<CardDraft>) =>
                      setCards((list) => list.map((c) => (c.key === card.key ? { ...c, ...change } : c)))
                    return (
                      <li key={card.key} className="rounded-2xl border border-line bg-surface p-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Nome do cartão">
                            {(id) => <Input id={id} value={card.name} placeholder="Ex.: Nubank" maxLength={60} onChange={(e) => patch({ name: e.target.value })} />}
                          </Field>
                          <Field label="Limite">
                            {(id) => <MoneyInput id={id} value={card.limit} onChange={(v) => patch({ limit: v })} />}
                          </Field>
                          <Field label="Dia de fechamento">
                            {(id) => <Input id={id} type="number" inputMode="numeric" min={1} max={31} value={card.closing} onChange={(e) => patch({ closing: e.target.value })} />}
                          </Field>
                          <Field label="Dia de vencimento">
                            {(id) => <Input id={id} type="number" inputMode="numeric" min={1} max={31} value={card.due} onChange={(e) => patch({ due: e.target.value })} />}
                          </Field>
                        </div>
                        <div className="mt-2 text-right">
                          <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setCards((list) => list.filter((c) => c.key !== card.key))}>
                            Remover
                          </Button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
                <Button variant="secondary" size="sm" icon={Plus} onClick={addCard}>
                  Adicionar cartão
                </Button>
              </>
            )}
          </Step>
        )}

        {step === 3 && (
          <Step title="Quais são seus principais gastos fixos?" subtitle="Marque os que você tem e informe valor e dia de vencimento. Dá para ajustar depois.">
            <div className="flex flex-wrap gap-2">
              {FIXED_PRESETS.map((preset) => {
                const selected = fixed.some((f) => f.description === preset[0])
                return (
                  <button key={preset[0]} type="button" aria-pressed={selected} onClick={() => togglePreset(preset)} className={chip(selected)}>
                    {selected && <Check className="size-4" aria-hidden />}
                    {preset[0]}
                  </button>
                )
              })}
            </div>
            <ul className="space-y-2">
              {fixed.map((item) => {
                const patch = (change: Partial<FixedDraft>) =>
                  setFixed((list) => list.map((f) => (f.key === item.key ? { ...f, ...change } : f)))
                return (
                  <li key={item.key} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-2xl border border-line bg-surface p-3 sm:grid-cols-[1fr_9rem_5rem_auto]">
                    <Input aria-label="Descrição" value={item.description} placeholder="Descrição" maxLength={120} onChange={(e) => patch({ description: e.target.value })} />
                    <IconButton icon={Trash2} label={`Remover ${item.description}`} tone="danger" className="sm:order-last" onClick={() => setFixed((list) => list.filter((f) => f.key !== item.key))} />
                    <MoneyInput aria-label={`Valor de ${item.description}`} value={item.amount} onChange={(v) => patch({ amount: v })} />
                    <Input aria-label={`Dia de vencimento de ${item.description}`} type="number" inputMode="numeric" min={1} max={31} value={item.day} onChange={(e) => patch({ day: e.target.value })} />
                  </li>
                )
              })}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                variant="secondary"
                size="sm"
                icon={Plus}
                onClick={() => setFixed((list) => [...list, { key: crypto.randomUUID(), description: '', amount: 0, day: '10', categoryId: null }])}
              >
                Outro gasto fixo
              </Button>
              {fixed.length > 0 && (
                <p className="text-sm text-muted">
                  Total: <span className="tnum font-bold text-ink">{formatBRL(fixed.reduce((sum, f) => sum + f.amount, 0))}</span>
                </p>
              )}
            </div>
          </Step>
        )}

        {step === 4 && (
          <Step title="Qual seu objetivo financeiro?" subtitle="Usamos isso para montar seu primeiro planejamento do mês.">
            <div role="radiogroup" aria-label="Objetivo financeiro" className="space-y-2">
              {GOALS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={goalId === option.id}
                  onClick={() => setGoalId(option.id)}
                  className={cn(chip(goalId === option.id), 'w-full justify-between py-3 text-left')}
                >
                  {option.label}
                  {goalId === option.id && <Check className="size-4 shrink-0" aria-hidden />}
                </button>
              ))}
            </div>
            {goal.needsTarget && (
              <div className="grid gap-4 sm:grid-cols-2">
                {!goal.emergency && (
                  <Field label="Nome do objetivo">
                    {(id) => <Input id={id} value={goalName} placeholder="Ex.: Viagem" maxLength={60} onChange={(e) => setGoalName(e.target.value)} />}
                  </Field>
                )}
                <Field label="Quanto quer juntar?" hint={goal.emergency ? 'Referência: 6 meses das suas despesas.' : undefined}>
                  {(id) => <MoneyInput id={id} value={goalTarget} onChange={setGoalTarget} />}
                </Field>
              </div>
            )}
          </Step>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-xl bg-neg-soft px-4 py-3 text-sm font-medium text-neg">
          {error}
        </p>
      )}

      <div className="mt-6 flex items-center justify-between gap-3 pb-[env(safe-area-inset-bottom)]">
        <Button
          variant="ghost"
          icon={ArrowLeft}
          disabled={step === 0 || saving}
          onClick={() => {
            setError(null)
            setStep((s) => s - 1)
          }}
        >
          Voltar
        </Button>
        <Button size="lg" onClick={next} loading={saving}>
          {step === STEPS.length - 1 ? 'Concluir' : 'Continuar'}
          {!saving && step < STEPS.length - 1 && <ArrowRight className="size-4" aria-hidden />}
        </Button>
      </div>
    </div>
  )
}

function Step({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section>
      <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{title}</h1>
      <p className="mt-2 mb-7 text-sm text-muted">{subtitle}</p>
      <div className="space-y-5">{children}</div>
    </section>
  )
}
