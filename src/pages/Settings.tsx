import { useState, type FormEvent, type ReactNode } from 'react'
import { CircleCheck, Database, FlaskConical, LogOut, RotateCcw, Sparkles } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Segmented } from '@/components/ui/Feedback'
import { Field, Input } from '@/components/ui/Form'
import { useAuth } from '@/contexts/AuthContext'
import { useFinance } from '@/contexts/FinanceContext'
import { useTheme, type ThemePreference } from '@/contexts/ThemeContext'
import { useToast } from '@/contexts/ToastContext'
import { useDb } from '@/hooks/useDb'
import { loadDemoData, resetAccount } from '@/services/operations'

const THEMES: Array<{ value: ThemePreference; label: string }> = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
  { value: 'system', label: 'Sistema' },
]

export default function Settings() {
  const { profile } = useFinance()
  const { user, demo, signOut, updatePassword } = useAuth()
  const { preference, setPreference } = useTheme()
  const toast = useToast()
  const db = useDb()

  const [name, setName] = useState(profile.full_name)
  const [payDay, setPayDay] = useState(profile.pay_day ? String(profile.pay_day) : '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  const [password, setPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const [confirm, setConfirm] = useState<'demo' | 'reset' | null>(null)

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault()
    const day = payDay ? Number(payDay) : null
    if (!name.trim()) return setProfileError('Informe seu nome.')
    if (day !== null && !(Number.isInteger(day) && day >= 1 && day <= 31)) {
      return setProfileError('O dia de recebimento precisa estar entre 1 e 31.')
    }
    setProfileError(null)
    setSavingProfile(true)
    await db.update('profiles', profile.id, { full_name: name.trim(), pay_day: day }, 'Perfil atualizado')
    setSavingProfile(false)
  }

  const savePassword = async (event: FormEvent) => {
    event.preventDefault()
    if (password.length < 6) return setPasswordError('A senha precisa ter pelo menos 6 caracteres.')
    setPasswordError(null)
    setSavingPassword(true)
    try {
      await updatePassword(password)
      setPassword('')
      toast.success('Senha alterada')
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Não foi possível alterar a senha.')
    }
    setSavingPassword(false)
  }

  return (
    <>
      <PageHeader title="Configurações" subtitle="Perfil, aparência e seus dados." />

      <div className="grid max-w-3xl gap-4">
        <Card>
          <CardHeader title="Perfil" />
          <form onSubmit={saveProfile} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome" error={profileError ?? undefined}>
                {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />}
              </Field>
              <Field label="Dia em que costuma receber" hint="Opcional.">
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={31}
                    value={payDay}
                    onChange={(e) => setPayDay(e.target.value)}
                  />
                )}
              </Field>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-muted">{user?.email}</p>
              <Button type="submit" loading={savingProfile}>
                Salvar perfil
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader title="Aparência" subtitle="Tema claro, escuro ou o do seu dispositivo" />
          <Segmented label="Tema" value={preference} onChange={setPreference} options={THEMES} />
        </Card>

        <Card>
          <CardHeader title="Conexão com o banco de dados" />
          {demo ? (
            <div className="flex items-start gap-3 rounded-xl bg-warn-soft p-4 text-sm text-warn">
              <FlaskConical className="mt-0.5 size-5 shrink-0" aria-hidden />
              <div className="space-y-1">
                <p className="font-bold">Modo demonstração</p>
                <p>
                  Os dados ficam apenas neste navegador. Para salvar na nuvem, crie um projeto no Supabase, execute o
                  arquivo <code className="font-mono text-[13px]">supabase/schema.sql</code> e preencha{' '}
                  <code className="font-mono text-[13px]">VITE_SUPABASE_URL</code> e{' '}
                  <code className="font-mono text-[13px]">VITE_SUPABASE_ANON_KEY</code> no arquivo{' '}
                  <code className="font-mono text-[13px]">.env</code>. O passo a passo está no README.
                </p>
              </div>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm font-medium text-pos">
              <CircleCheck className="size-5" aria-hidden />
              Conectado ao Supabase. Seus dados são salvos na sua conta.
            </p>
          )}
        </Card>

        {!demo && (
          <Card>
            <CardHeader title="Alterar senha" />
            <form onSubmit={savePassword} className="flex flex-wrap items-start gap-3" noValidate>
              <Field label="Nova senha" error={passwordError ?? undefined} className="min-w-56 flex-1">
                {(id) => (
                  <Input
                    id={id}
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                )}
              </Field>
              <Button type="submit" variant="secondary" loading={savingPassword} className="mt-[26px]">
                Alterar senha
              </Button>
            </form>
          </Card>
        )}

        <Card>
          <CardHeader title="Seus dados" subtitle="Ações que substituem tudo o que está cadastrado" />
          <div className="divide-y divide-line">
            <DataAction
              icon={Sparkles}
              title="Carregar dados de exemplo"
              description="Substitui seus dados por sete meses de movimentações fictícias, para explorar o app."
              action={
                <Button variant="secondary" size="sm" onClick={() => setConfirm('demo')}>
                  Carregar
                </Button>
              }
            />
            <DataAction
              icon={RotateCcw}
              title="Recomeçar do zero"
              description="Apaga todos os lançamentos, contas, cartões e metas e refaz a configuração inicial."
              action={
                <Button variant="secondary" size="sm" onClick={() => setConfirm('reset')}>
                  Recomeçar
                </Button>
              }
            />
            <DataAction
              icon={Database}
              title="Sair da conta"
              description={demo ? 'Os dados continuam salvos neste navegador.' : 'Encerra a sessão neste dispositivo.'}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  icon={LogOut}
                  onClick={() => signOut().catch((e: Error) => toast.error(e.message))}
                >
                  Sair
                </Button>
              }
            />
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={confirm === 'demo'}
        onClose={() => setConfirm(null)}
        title="Carregar dados de exemplo?"
        description="Tudo o que você cadastrou será apagado e substituído pelos dados fictícios. Não dá para desfazer."
        confirmLabel="Substituir meus dados"
        onConfirm={() => db.run(() => loadDemoData(profile.id), 'Dados de exemplo carregados')}
      />
      <ConfirmDialog
        open={confirm === 'reset'}
        onClose={() => setConfirm(null)}
        title="Recomeçar do zero?"
        description="Todos os seus dados serão apagados e você voltará para a configuração inicial. Não dá para desfazer."
        confirmLabel="Apagar tudo"
        onConfirm={() => db.run(() => resetAccount(profile.id), 'Dados apagados')}
      />
    </>
  )
}

interface DataActionProps {
  icon: typeof Database
  title: string
  description: string
  action: ReactNode
}

function DataAction({ icon: Icon, title, description, action }: DataActionProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 py-4 first:pt-0 last:pb-0">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-2">
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <div className="min-w-48 flex-1">
        <p className="text-sm font-bold text-ink">{title}</p>
        <p className="text-[13px] text-muted">{description}</p>
      </div>
      {action}
    </div>
  )
}
