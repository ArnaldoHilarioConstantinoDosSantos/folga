import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Cliente do Supabase. Fica `null` quando as variáveis de ambiente não foram
 * preenchidas — nesse caso o app roda em modo demonstração (dados no navegador).
 */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null

export const isSupabaseConfigured = supabase !== null
