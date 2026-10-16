import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Form'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { AuthLayout } from '@/layouts/AuthLayout'
import { FormError, messageOf } from './shared'

/** Destino do link enviado por e-mail: o Supabase abre a sessão e aqui a senha é trocada. */
export default function ResetPassword() {
  const { updatePassword, user, loading } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (password.length < 6) return setError('A senha precisa ter pelo menos 6 caracteres.')
    if (password !== confirm) return setError('As senhas não são iguais.')
    setBusy(true)
    setError(null)
    try {
      await updatePassword(password)
      toast.success('Senha alterada')
      navigate('/', { replace: true })
    } catch (err) {
      setError(messageOf(err))
      setBusy(false)
    }
  }

  const expired = !loading && !user

  return (
    <AuthLayout
      title="Nova senha"
      subtitle="Escolha uma senha nova para sua conta."
      footer={
        <Link to="/entrar" className="font-bold text-brand hover:underline">
          Voltar para o login
        </Link>
      }
    >
      {expired ? (
        <FormError message="Este link expirou ou já foi usado. Solicite a recuperação de senha novamente." />
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Nova senha" hint="Pelo menos 6 caracteres.">
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
          <Field label="Confirmar senha">
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-12"
              />
            )}
          </Field>
          <FormError message={error} />
          <Button type="submit" size="lg" className="w-full" loading={busy || loading}>
            Salvar nova senha
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
