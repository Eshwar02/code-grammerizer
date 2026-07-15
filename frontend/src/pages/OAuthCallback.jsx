import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { authApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

// Landing page after the Google redirect. Reads the Supabase session from the
// URL, exchanges its access token for our app JWT via /auth/google, then routes
// into the app.
export default function OAuthCallback() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) throw new Error('No Google session')
        const { data } = await authApi.google({ access_token: session.access_token })
        await supabase.auth.signOut()
        login(data.token, data.user)
        toast.success(`Welcome, ${data.user.name}!`)
        navigate('/dashboard', { replace: true })
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Google sign-in failed')
        navigate('/login', { replace: true })
      }
    })()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-50">
      <div className="flex items-center gap-3 text-ink-500">
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        Signing you in…
      </div>
    </div>
  )
}
