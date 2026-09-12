import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly in dev rather than silently breaking realtime later.
  // eslint-disable-next-line no-console
  console.error(
    'Missing Supabase environment variables. Copy .env.example to .env and fill in ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  )
}

// Only the public anon key is ever used on the client. Row Level Security
// (see supabase/schema.sql) is what keeps this safe — the anon key alone
// grants no special access.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  },
  realtime: {
    params: { eventsPerSecond: 20 }
  }
})

export const ROOM_EXPIRY_MINUTES = Number(import.meta.env.VITE_ROOM_EXPIRY_MINUTES ?? 30)

/**
 * Ensures the current browser tab has a temporary anonymous Supabase
 * session. This is NOT an account: there is no email, password, username,
 * or profile — just an opaque session id (auth.uid()) used internally so
 * Row Level Security can tell "this request came from a participant of
 * this room" apart from anyone else on the internet. Nothing about this
 * identity is ever shown in the UI.
 */
export async function ensureAnonymousSession() {
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session

  const { data: signInData, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  return signInData.session
}
