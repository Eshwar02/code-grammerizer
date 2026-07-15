import { createClient } from '@supabase/supabase-js'

// Client-side Supabase used ONLY for Google OAuth. Everything else goes through
// our own backend + JWT. detectSessionInUrl lets the /oauth/callback page read
// the session Supabase returns in the URL hash after the Google redirect.
const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(url, anon, {
  auth: { detectSessionInUrl: true, persistSession: false, autoRefreshToken: false },
})

export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/oauth/callback` },
  })
}
