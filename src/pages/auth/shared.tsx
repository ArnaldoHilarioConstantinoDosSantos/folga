import { useState } from 'react'
import { CircleAlert, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'

export const messageOf = (error: unknown) =>
  error instanceof Error && error.message ? error.message : 'Não foi possível concluir. Tente novamente.'

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl bg-neg-soft px-3 py-2.5 text-[13px] font-medium text-neg">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      {message}
    </p>
  )
}

export function DemoNotice() {
  const { demo } = useAuth()
  if (!demo) return null
  return (
    <p className="mb-6 flex items-start gap-2.5 rounded-xl bg-warn-soft px-3.5 py-3 text-[13px] text-warn">
      <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        <strong className="font-bold">Modo demonstração.</strong> O Supabase ainda não foi conectado: qualquer e-mail
        e senha entram, e os dados ficam apenas neste navegador.
      </span>
    </p>
  )
}

export function Divider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs font-medium text-muted">
      <span className="h-px flex-1 bg-line" />
      ou
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}

export function GoogleButton({ onError }: { onError: (message: string) => void }) {
  const { signInWithGoogle } = useAuth()
  const [busy, setBusy] = useState(false)
  return (
    <Button
      variant="outline"
      size="lg"
      className="w-full"
      loading={busy}
      onClick={async () => {
        setBusy(true)
        try {
          await signInWithGoogle()
        } catch (error) {
          onError(messageOf(error))
          setBusy(false)
        }
      }}
    >
      {!busy && (
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
        </svg>
      )}
      Continuar com Google
    </Button>
  )
}
