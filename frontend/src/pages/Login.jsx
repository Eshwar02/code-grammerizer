import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../services/api'
import GoogleButton from '../components/GoogleButton'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Code2, Zap, ShieldCheck } from 'lucide-react'

export default function Login() {
  useEffect(() => {
    const wasDark = document.documentElement.classList.contains('dark')
    document.documentElement.classList.remove('dark')
    return () => { if (wasDark) document.documentElement.classList.add('dark') }
  }, [])
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [errors, setErrors] = useState({})

  const validate = () => {
    const e = {}
    if (!form.email.includes('@')) e.email = 'Valid email required'
    if (form.password.length < 1) e.password = 'Password required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const { data } = await authApi.login(form)
      login(data.token, data.user)
      toast.success(`Welcome back, ${data.user.name}!`)
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-ink-50 flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-2/5 bg-blue-400 flex-col justify-between p-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white flex items-center justify-center">
            <Code2 size={16} className="text-blue-400" />
          </div>
          <span className="font-bold text-xl text-white">Code-Grammerizer</span>
        </div>
        <div className="space-y-8">
          {[
            [Zap, 'Instant Analysis', 'Get AI-powered code review in seconds with Pylint, Bandit, and Radon.'],
            [ShieldCheck, 'Security First', 'Detect vulnerabilities before they reach production.'],
            [Code2, 'Smart Suggestions', 'Receive actionable improvement suggestions with code examples.'],
          ].map(([Icon, title, desc]) => (
            <div key={title} className="flex gap-3">
              <div className="w-8 h-8 bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
                <Icon size={16} className="text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{title}</p>
                <p className="text-blue-100 text-xs mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-blue-200 text-xs">Code-Grammerizer · Built with FastAPI + React</p>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-7 h-7 bg-blue-400 flex items-center justify-center">
              <Code2 size={14} className="text-white" />
            </div>
            <span className="font-bold text-lg text-ink-900">Code-Grammerizer</span>
          </div>

          <h1 className="text-2xl font-bold text-ink-900 mb-1">Sign in</h1>
          <p className="text-sm text-ink-400 mb-8">Welcome back — let's review some code</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-xs font-semibold text-ink-600 uppercase tracking-wide mb-1.5 block">Email</label>
              <input
                className={`input ${errors.email ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : ''}`}
                type="email" autoComplete="email" required
                value={form.email}
                onChange={(e) => { setForm({ ...form, email: e.target.value }); setErrors({ ...errors, email: '' }) }}
                placeholder="you@example.com"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-ink-600 uppercase tracking-wide">Password</label>
              </div>
              <div className="relative">
                <input
                  className={`input pr-10 ${errors.password ? 'border-red-400' : ''}`}
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password" required
                  value={form.password}
                  onChange={(e) => { setForm({ ...form, password: e.target.value }); setErrors({ ...errors, password: '' }) }}
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            <button type="submit"
              className="btn-primary w-full flex items-center justify-center gap-2 py-3"
              disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Signing in…
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1 bg-ink-200" />
            <span className="text-xs text-ink-400">or</span>
            <div className="h-px flex-1 bg-ink-200" />
          </div>
          <GoogleButton label="Continue with Google" />

          <div className="mt-6 pt-6 border-t border-ink-200 text-center">
            <p className="text-sm text-ink-400">
              No account?{' '}
              <Link to="/register" className="text-blue-500 font-semibold hover:underline">Create one →</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
