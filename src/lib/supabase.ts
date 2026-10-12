import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

// Every query goes to the `house` schema; Haru's tables are never touched.
export const supabase = createClient(url ?? 'http://localhost:54321', anonKey ?? 'not-configured', {
  db: { schema: 'house' },
})
