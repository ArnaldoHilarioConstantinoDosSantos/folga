import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Form'
import { useAuth } from '@/contexts/AuthContext'
import { AuthLayout } from '@/layouts/AuthLayout'
import { DemoNotice, Divider, FormError, GoogleButton, messageOf } from './shared'

export default function Register() {
  const { signUp } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim() || !email.trim()) return setError('Preencha nome e e-mail.')
    if (password.length < 6) return setError('A senha precisa ter pelo menos 6 caracteres.')
    setBusy(true)
    setError(null)
    try {
      const { needsConfirmation } = await signUp(name.trim(), email.trim(), password)
      if (needsConfirmation) setSent(true)
    } catch (err) {
      setError(messageOf(err))
    }
    setBusy(false)
  }

  if (sent) {
    return (
      <AuthLayout
        title="Confirme seu e-mail"
        subtitle={`Enviamos um link de confirmação para ${email}.`}
        footer={
          <Link to="/entrar" className="font-bold text-brand hover:underline">
            Voltar para o login
          </Link>
        }
      >
        <div className="flex items-start gap-3 rounded-2xl bg-brand-soft p-4 text-sm text-brand">
          <MailCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
          Abra o e-mail e clique no link para ativar sua conta. Depois é só entrar.
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Criar conta"
      subtitle="Leva menos de um minuto."
      footer={
        <>
          Já tem conta?{' '}
          <Link to="/entrar" className="font-bold text-brand hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <DemoNotice />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nome">
          {(id) => (
            <Input
              id={id}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Como quer ser chamado"
              className="h-12"
            />
          )}
        </Field>
        <Field label="E-mail">
          {(id) => (
            <Input
              id={id}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              className="h-12"
            />
          )}
        </Field>
        <Field label="Senha" hint="Pelo menos 6 caracteres.">
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12"
            />
          )}
        </Field>
        <FormError message={error} />
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Criar conta
        </Button>
      </form>
      <Divider />
      <GoogleButton onError={setError} />
    </AuthLayout>
  )
}
