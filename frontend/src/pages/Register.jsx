import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Code2, Check, X } from 'lucide-react'

function StrengthBar({ password }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ]
  const score = checks.filter(Boolean).length
  const colors = ['bg-red-400', 'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-lime-400']
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']

  if (!password) return null
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[1,2,3,4].map((i) => (
          <div key={i} className={`h-1 flex-1 ${i <= score ? colors[score] : 'bg-ink-200'} transition-colors`} />
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-ink-400">{labels[score]}</span>
        {[
          [password.length >= 8, '8+ chars'],
          [/[A-Z]/.test(password), 'Uppercase'],
          [/[0-9]/.test(password), 'Number'],
        ].map(([ok, label]) => (
          <span key={label} className={`flex items-center gap-0.5 text-xs ${ok ? 'text-lime-500' : 'text-ink-300'}`}>
            {ok ? <Check size={10} /> : <X size={10} />} {label}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function Register() {
  useEffect(() => {
    const wasDark = document.documentElement.classList.contains('dark')
    document.documentElement.classList.remove('dark')
    return () => { if (wasDark) document.documentElement.classList.add('dark') }
  }, [])

  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [errors, setErrors] = useState({})
  const [step, setStep] = useState('form') // 'form' | 'otp'
  const [otp, setOtp] = useState('')

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Name required'
    else if (/\d/.test(form.name)) e.name = 'Name cannot contain numbers'
    else if (!/^[A-Za-z][A-Za-z .'-]*$/.test(form.name.trim())) e.name = 'Letters only'
    if (!form.email.includes('@')) e.email = 'Valid email required'
    if (form.password.length < 6) e.password = 'Minimum 6 characters'
    if (form.password !== form.confirm) e.confirm = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // Step 1: validate + email a verification code via Supabase mailer.
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await authApi.requestOtp({ name: form.name, email: form.email, password: form.password })
      setStep('otp')
      toast.success('Verification code sent to your email')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not send verification code')
    } finally {
      setLoading(false)
    }
  }

  // Step 2: verify OTP + create the account.
  const handleVerify = async (e) => {
    e.preventDefault()
    if (otp.trim().length < 6) { toast.error('Enter the 6-digit code'); return }
    setLoading(true)
    try {
      const { data } = await authApi.register({ name: form.name, email: form.email, password: form.password, otp: otp.trim() })
      login(data.token, data.user)
      toast.success('Account created!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const resendOtp = async () => {
    try {
      await authApi.requestOtp({ name: form.name, email: form.email, password: form.password })
      toast.success('Code resent')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not resend code')
    }
  }

  return (
    <div className="min-h-screen bg-ink-50 flex">
      <div className="hidden lg:flex lg:w-2/5 bg-blue-400 flex-col justify-between p-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white flex items-center justify-center">
            <Code2 size={16} className="text-blue-400" />
          </div>
          <span className="font-bold text-xl text-white">Code-Grammerizer</span>
        </div>
        <div className="space-y-4">
          <h2 className="text-3xl font-bold text-white leading-tight">Start reviewing<br />code smarter.</h2>
          <p className="text-blue-100 text-sm leading-relaxed">
            Join developers using AI-powered static analysis to catch bugs, security vulnerabilities, and code smells before they ship.
          </p>
          <div className="space-y-2 pt-2">
            {['Free to use', 'Works with Python, JS, Java, Go, C++', 'Live review while you type', 'AI + offline static analysis'].map((f) => (
              <div key={f} className="flex items-center gap-2">
                <div className="w-4 h-4 bg-lime-400 flex items-center justify-center">
                  <Check size={10} className="text-white" />
                </div>
                <span className="text-white text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-blue-200 text-xs">Code-Grammerizer · Powered by Cerebras</p>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-7 h-7 bg-blue-400 flex items-center justify-center">
              <Code2 size={14} className="text-white" />
            </div>
            <span className="font-bold text-lg text-ink-900">Code-Grammerizer</span>
          </div>

          <h1 className="text-2xl font-bold text-ink-900 mb-1">
            {step === 'form' ? 'Create account' : 'Verify your email'}
          </h1>
          <p className="text-sm text-ink-400 mb-8">
            {step === 'form'
              ? 'Get started with Code-Grammerizer for free'
              : <>We sent a 6-digit code to <span className="font-semibold text-ink-600">{form.email}</span></>}
          </p>

          {step === 'form' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-ink-600 uppercase tracking-wide mb-1.5 block">Full Name</label>
              <input className={`input ${errors.name ? 'border-red-400' : ''}`}
                type="text" autoComplete="name" required placeholder="John Doe"
                value={form.name}
                onChange={(e) => { setForm({ ...form, name: e.target.value.replace(/[0-9]/g, '') }); setErrors({ ...errors, name: '' }) }} />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="text-xs font-semibold text-ink-600 uppercase tracking-wide mb-1.5 block">Email</label>
              <input className={`input ${errors.email ? 'border-red-400' : ''}`}
                type="email" autoComplete="email" required placeholder="you@example.com"
                value={form.email}
                onChange={(e) => { setForm({ ...form, email: e.target.value }); setErrors({ ...errors, email: '' }) }} />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="text-xs font-semibold text-ink-600 uppercase tracking-wide mb-1.5 block">Password</label>
              <div className="relative">
                <input className={`input pr-10 ${errors.password ? 'border-red-400' : ''}`}
                  type={showPw ? 'text' : 'password'} autoComplete="new-password" required placeholder="Min 6 characters"
                  value={form.password}
                  onChange={(e) => { setForm({ ...form, password: e.target.value }); setErrors({ ...errors, password: '' }) }} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <StrengthBar password={form.password} />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            <div>
              <label className="text-xs font-semibold text-ink-600 uppercase tracking-wide mb-1.5 block">Confirm Password</label>
              <input className={`input ${errors.confirm ? 'border-red-400' : ''}`}
                type={showPw ? 'text' : 'password'} autoComplete="new-password" required placeholder="Repeat password"
                value={form.confirm}
                onChange={(e) => { setForm({ ...form, confirm: e.target.value }); setErrors({ ...errors, confirm: '' }) }} />
              {errors.confirm && <p className="text-red-500 text-xs mt-1">{errors.confirm}</p>}
            </div>

            <button type="submit"
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 mt-2"
              disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Creating account…
                </span>
              ) : 'Create Account'}
            </button>
          </form>
          ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-ink-600 uppercase tracking-wide mb-1.5 block">Verification Code</label>
              <input className="input tracking-[0.5em] text-center text-lg font-semibold"
                type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                placeholder="000000" autoFocus
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            </div>

            <button type="submit"
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 mt-2"
              disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Verifying…
                </span>
              ) : 'Verify & Create Account'}
            </button>

            <div className="flex items-center justify-between text-xs">
              <button type="button" onClick={() => { setStep('form'); setOtp('') }}
                className="text-ink-400 hover:text-ink-700">← Back</button>
              <button type="button" onClick={resendOtp}
                className="text-blue-500 font-semibold hover:underline">Resend code</button>
            </div>
          </form>
          )}

          <div className="mt-6 pt-6 border-t border-ink-200 text-center">
            <p className="text-sm text-ink-400">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-500 font-semibold hover:underline">Sign in →</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
