import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'

interface ThemeValue {
  preference: ThemePreference
  resolved: 'light' | 'dark'
  setPreference: (value: ThemePreference) => void
  toggle: () => void
}

const STORAGE_KEY = 'folga:theme'
const ThemeContext = createContext<ThemeValue | null>(null)

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPref] = useState<ThemePreference>(readPreference)
  const [system, setSystem] = useState<'light' | 'dark'>(() => (systemDark() ? 'dark' : 'light'))

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystem(media.matches ? 'dark' : 'light')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const resolved = preference === 'system' ? system : preference

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark')
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', resolved === 'dark' ? '#0c1210' : '#f4f6f2')
  }, [resolved])

  const setPreference = useCallback((value: ThemePreference) => {
    setPref(value)
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      /* preferência só não será lembrada */
    }
  }, [])

  const value = useMemo<ThemeValue>(
    () => ({
      preference,
      resolved,
      setPreference,
      toggle: () => setPreference(resolved === 'dark' ? 'light' : 'dark'),
    }),
    [preference, resolved, setPreference],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme precisa estar dentro de ThemeProvider')
  return ctx
}
