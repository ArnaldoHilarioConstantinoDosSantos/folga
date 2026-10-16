import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Form'
import { useAuth } from '@/contexts/AuthContext'
import { AuthLayout } from '@/layouts/AuthLayout'
import { FormError, messageOf } from './shared'

export default function ForgotPassword() {
  const { sendPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!email.trim()) return setError('Informe seu e-mail.')
    setBusy(true)
    setError(null)
    try {
      await sendPasswordReset(email.trim())
      setSent(true)
    } catch (err) {
      setError(messageOf(err))
    }
    setBusy(false)
  }

  return (
    <AuthLayout
      title="Recuperar senha"
      subtitle="Enviaremos um link para você criar uma nova senha."
      footer={
        <Link to="/entrar" className="font-bold text-brand hover:underline">
          Voltar para o login
        </Link>
      }
    >
      {sent ? (
        <div className="flex items-start gap-3 rounded-2xl bg-brand-soft p-4 text-sm text-brand">
          <MailCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
          Se existir uma conta com {email}, o link de recuperação chegará em instantes. Confira também o spam.
        </div>
      ) : (
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
          <FormError message={error} />
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Enviar link
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
