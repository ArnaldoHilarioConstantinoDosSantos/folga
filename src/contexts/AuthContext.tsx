import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isSupabaseConfigured } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import { auth, type AuthService, type AuthUser } from '@/services/auth'

interface AuthValue extends Omit<AuthService, 'getUser' | 'onChange'> {
  user: AuthUser | null
  /** Verdadeiro enquanto a sessão salva ainda está sendo lida. */
  loading: boolean
  /** Modo demonstração: sem Supabase, dados apenas neste navegador. */
  demo: boolean
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const apply = (next: AuthUser | null) => {
      if (!active) return
      setUser((prev) => {
        // Troca de usuário: nada do cache do anterior pode sobrar.
        if (prev?.id !== next?.id) queryClient.clear()
        return prev?.id === next?.id && prev?.name === next?.name && prev?.email === next?.email ? prev : next
      })
      setLoading(false)
    }
    auth.getUser().then(apply, () => apply(null))
    const unsubscribe = auth.onChange(apply)
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      demo: !isSupabaseConfigured,
      signIn: auth.signIn,
      signUp: auth.signUp,
      signInWithGoogle: auth.signInWithGoogle,
      signOut: auth.signOut,
      sendPasswordReset: auth.sendPasswordReset,
      updatePassword: auth.updatePassword,
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de AuthProvider')
  return ctx
}
