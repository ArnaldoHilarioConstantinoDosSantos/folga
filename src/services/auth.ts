import { supabase } from '@/lib/supabase'
import { LOCAL_USER_ID } from './db/localDriver'

/** Endereço absoluto dentro do app, respeitando a subpasta em que ele foi publicado. */
const appUrl = (path = '') => `${window.location.origin}${import.meta.env.BASE_URL}${path}`

export interface AuthUser {
  id: string
  email: string
  name: string
}

export interface AuthService {
  getUser(): Promise<AuthUser | null>
  /** Avisa a cada entrada, saída ou troca de sessão. Devolve a função para cancelar. */
  onChange(callback: (user: AuthUser | null) => void): () => void
  signIn(email: string, password: string): Promise<void>
  /** `needsConfirmation` indica que o Supabase enviou um e-mail de confirmação. */
  signUp(name: string, email: string, password: string): Promise<{ needsConfirmation: boolean }>
  signInWithGoogle(): Promise<void>
  signOut(): Promise<void>
  sendPasswordReset(email: string): Promise<void>
  updatePassword(password: string): Promise<void>
}

export class AuthError extends Error {}

const MESSAGES: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
  [/email not confirmed/i, 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.'],
  [/already registered|already been registered/i, 'Este e-mail já está cadastrado.'],
  [/password should be at least/i, 'A senha precisa ter pelo menos 6 caracteres.'],
  [/rate limit|too many/i, 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'],
  [/unable to validate email|invalid email/i, 'E-mail inválido.'],
  [/provider is not enabled/i, 'O login com Google ainda não foi ativado no Supabase.'],
  [/same password|different from the old/i, 'A nova senha precisa ser diferente da atual.'],
  [/session missing|not authenticated/i, 'O link expirou. Solicite a recuperação de senha novamente.'],
  [/fetch|network/i, 'Sem conexão com o servidor. Tente novamente.'],
]

function translate(message: string): AuthError {
  const match = MESSAGES.find(([pattern]) => pattern.test(message))
  return new AuthError(match ? match[1] : 'Não foi possível concluir. Tente novamente.')
}

/* ------------------------------ Supabase ------------------------------ */

function createSupabaseAuth(client: NonNullable<typeof supabase>): AuthService {
  type SbUser = { id: string; email?: string; user_metadata?: Record<string, unknown> }
  const toUser = (u: SbUser | null | undefined): AuthUser | null =>
    u
      ? {
          id: u.id,
          email: u.email ?? '',
          name:
            (u.user_metadata?.full_name as string | undefined) ??
            (u.user_metadata?.name as string | undefined) ??
            u.email?.split('@')[0] ??
            '',
        }
      : null

  return {
    async getUser() {
      const { data } = await client.auth.getSession()
      return toUser(data.session?.user)
    },
    onChange(callback) {
      const { data } = client.auth.onAuthStateChange((_event, session) => callback(toUser(session?.user)))
      return () => data.subscription.unsubscribe()
    },
    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({ email, password })
      if (error) throw translate(error.message)
    },
    async signUp(name, email, password) {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { full_name: name }, emailRedirectTo: appUrl() },
      })
      if (error) throw translate(error.message)
      return { needsConfirmation: !data.session }
    },
    async signInWithGoogle() {
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: appUrl() },
      })
      if (error) throw translate(error.message)
    },
    async signOut() {
      const { error } = await client.auth.signOut()
      if (error) throw translate(error.message)
    },
    async sendPasswordReset(email) {
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: appUrl('redefinir-senha'),
      })
      if (error) throw translate(error.message)
    },
    async updatePassword(password) {
      const { error } = await client.auth.updateUser({ password })
      if (error) throw translate(error.message)
    },
  }
}

/* --------------------------- Demonstração ----------------------------- */

const SESSION_KEY = 'folga:session'

/**
 * Sessão local do modo demonstração: não há servidor, então qualquer e-mail
 * entra no mesmo perfil guardado neste navegador. Nenhuma senha é armazenada.
 */
function createLocalAuth(): AuthService {
  const listeners = new Set<(user: AuthUser | null) => void>()
  const readSession = (): AuthUser | null => {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as AuthUser | null
    } catch {
      return null
    }
  }
  const setSession = (user: AuthUser | null) => {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user))
    else localStorage.removeItem(SESSION_KEY)
    listeners.forEach((fn) => fn(user))
  }
  const start = (email: string, name?: string) =>
    setSession({ id: LOCAL_USER_ID, email, name: name || readSession()?.name || email.split('@')[0] })

  return {
    async getUser() {
      return readSession()
    },
    onChange(callback) {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
    async signIn(email) {
      start(email)
    },
    async signUp(name, email) {
      start(email, name)
      return { needsConfirmation: false }
    },
    async signInWithGoogle() {
      throw new AuthError('O login com Google fica disponível depois de conectar o Supabase.')
    },
    async signOut() {
      setSession(null)
    },
    async sendPasswordReset() {
      throw new AuthError('A recuperação de senha fica disponível depois de conectar o Supabase.')
    },
    async updatePassword() {
      throw new AuthError('A troca de senha fica disponível depois de conectar o Supabase.')
    },
  }
}

export const auth: AuthService = supabase ? createSupabaseAuth(supabase) : createLocalAuth()
