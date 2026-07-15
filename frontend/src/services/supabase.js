import { createClient } from '@supabase/supabase-js'

// Client-side Supabase used ONLY for Google OAuth. Everything else goes through
// our own backend + JWT. detectSessionInUrl lets the /oauth/callback page read
// the session Supabase returns in the URL hash after the Google redirect.
const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

// Guard: if the env vars are missing on the deploy host, do NOT call createClient
// at import time — it throws "supabaseUrl is required", which would white-screen
// the entire app (Login imports this module). Instead leave Google login
// gracefully disabled until the vars are configured.
export const supabase = url && anon
  ? createClient(url, anon, {
      auth: { detectSessionInUrl: true, persistSession: false, autoRefreshToken: false },
    })
  : null

if (!supabase) {
  console.warn('[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — Google login disabled.')
}

export async function signInWithGoogle() {
  if (!supabase) return { error: { message: 'Google login is not configured on this deployment' } }
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/oauth/callback` },
  })
}
