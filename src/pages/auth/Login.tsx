import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Form'
import { useAuth } from '@/contexts/AuthContext'
import { AuthLayout } from '@/layouts/AuthLayout'
import { DemoNotice, Divider, FormError, GoogleButton, messageOf } from './shared'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!email.trim() || !password) {
      setError('Preencha e-mail e senha.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      // O redirecionamento acontece sozinho quando a sessão muda.
      await signIn(email.trim(), password)
    } catch (err) {
      setError(messageOf(err))
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Entrar"
      subtitle="Acompanhe suas finanças em um só lugar."
      footer={
        <>
          Ainda não tem conta?{' '}
          <Link to="/cadastro" className="font-bold text-brand hover:underline">
            Criar conta
          </Link>
        </>
      }
    >
      <DemoNotice />
      <form onSubmit={submit} className="space-y-4" noValidate>
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
        <Field label="Senha">
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              className="h-12"
            />
          )}
        </Field>
        <div className="text-right">
          <Link to="/recuperar-senha" className="text-[13px] font-semibold text-brand hover:underline">
            Esqueci minha senha
          </Link>
        </div>
        <FormError message={error} />
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Entrar
        </Button>
      </form>
      <Divider />
      <GoogleButton onError={setError} />
    </AuthLayout>
  )
}
