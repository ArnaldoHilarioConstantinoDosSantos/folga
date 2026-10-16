import { supabase } from '@/lib/supabase'
import { createLocalDriver } from './localDriver'
import { createSupabaseDriver } from './supabaseDriver'
import type { Driver } from './types'

/** Único ponto de troca entre banco real e modo demonstração. */
export const db: Driver = supabase ? createSupabaseDriver(supabase) : createLocalDriver()

export type { Driver } from './types'
export { DataError } from './types'
