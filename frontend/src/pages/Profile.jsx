import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { authApi } from '../services/api'
import toast from 'react-hot-toast'
import { Eye, EyeOff, User, Lock, Save, Camera, RefreshCw, Star, Target, TrendingUp, Shield, Loader2, Quote } from 'lucide-react'

const DICEBEAR_STYLES = ['adventurer-neutral', 'avataaars', 'big-ears', 'croodles', 'fun-emoji', 'lorelei', 'micah', 'miniavs']

function StatCard({ icon, label, value, color, sub }) {
  return (
    <div className={`stat-box border-l-4 ${color} dark:bg-gray-900 dark:border-gray-700`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-ink-400 dark:text-gray-400">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-ink-900 dark:text-white">{value}</div>
      <div className="text-xs text-ink-400 dark:text-gray-500 font-medium uppercase tracking-wide mt-0.5">{label}</div>
      {sub && <div className="text-xs text-ink-300 dark:text-gray-600 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function Profile() {
  const { user, login } = useAuth()
  const [nameForm, setNameForm] = useState({ name: user?.name || '' })
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' })
  const [showPw, setShowPw] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const [pwErrors, setPwErrors] = useState({})
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '')
  const [avatarStyle, setAvatarStyle] = useState('adventurer-neutral')
  const [avatarSeed, setAvatarSeed] = useState(user?.name || 'user')
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const fileRef = useRef(null)

  useEffect(() => {
    authApi.stats().then(({ data }) => setStats(data)).catch(() => {}).finally(() => setStatsLoading(false))
  }, [])

  const getDiceBearUrl = (style, seed) =>
    `https://api.dicebear.com/10.x/${style}/svg?seed=${encodeURIComponent(seed)}`

  const currentAvatar = avatarUrl || getDiceBearUrl(avatarStyle, avatarSeed)

  const randomizeAvatar = () => {
    setAvatarSeed(Math.random().toString(36).substring(7))
    setAvatarUrl('')
  }

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const allowed = ['image/svg+xml', 'image/png', 'image/jpg', 'image/jpeg']
    if (!allowed.includes(file.type)) { toast.error('Only SVG, PNG, JPG allowed'); return }
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarUrl(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleUpdateName = async (e) => {
    e.preventDefault()
    if (!nameForm.name.trim()) { toast.error('Name required'); return }
    setSavingName(true)
    try {
      const payload = { name: nameForm.name, avatar_url: avatarUrl || getDiceBearUrl(avatarStyle, avatarSeed) }
      const { data } = await authApi.updateProfile(payload)
      const token = localStorage.getItem('token')
      login(token, { ...user, name: data.name, avatar_url: payload.avatar_url })
      toast.success('Profile updated')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Update failed')
    } finally {
      setSavingName(false)
    }
  }

  const validatePw = () => {
    const e = {}
    if (!pwForm.current_password) e.current = 'Required'
    if (pwForm.new_password.length < 6) e.new = 'Minimum 6 characters'
    if (pwForm.new_password !== pwForm.confirm) e.confirm = 'Passwords do not match'
    setPwErrors(e)
    return Object.keys(e).length === 0
  }

  const handleChangePw = async (e) => {
    e.preventDefault()
    if (!validatePw()) return
    setSavingPw(true)
    try {
      await authApi.changePassword({ current_password: pwForm.current_password, new_password: pwForm.new_password })
      toast.success('Password changed')
      setPwForm({ current_password: '', new_password: '', confirm: '' })
      setPwErrors({})
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Change failed')
    } finally {
      setSavingPw(false)
    }
  }

  const levelColor = (level) => {
    const map = { Beginner: 'text-blue-400', Intermediate: 'text-yellow-500', Advanced: 'text-lime-500', Expert: 'text-purple-500' }
    return map[level] || 'text-blue-400'
  }
  const levelBg = (level) => {
    const map = { Beginner: 'border-l-blue-400', Intermediate: 'border-l-yellow-400', Advanced: 'border-l-lime-400', Expert: 'border-l-purple-400' }
    return map[level] || 'border-l-blue-400'
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-xl font-bold text-ink-900 dark:text-white mb-8">Profile</h1>

      {/* AI Insights */}
      {statsLoading ? (
        <div className="card mb-6 flex items-center gap-3 dark:bg-gray-900 dark:border-gray-700">
          <Loader2 size={16} className="animate-spin text-blue-400" />
          <span className="text-sm text-ink-400 dark:text-gray-400">Loading your insights…</span>
        </div>
      ) : stats && (
        <div className="space-y-4 mb-6">
          {/* Level + Quote */}
          <div className={`card border-l-4 ${levelBg(stats.level)} dark:bg-gray-900 dark:border-gray-700`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="text-xs font-semibold text-ink-400 dark:text-gray-500 uppercase tracking-wide">Skill Level</span>
                <div className={`text-2xl font-bold mt-0.5 ${levelColor(stats.level)}`}>{stats.level || 'Intermediate'}</div>
              </div>
              <Star size={20} className={levelColor(stats.level)} />
            </div>
            {stats.encouragement && (
              <p className="text-sm text-ink-700 dark:text-gray-300 leading-relaxed">{stats.encouragement}</p>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard icon={<TrendingUp size={14} />} label="Avg Score" value={`${stats.avg_score}/100`} color="border-l-blue-400" />
            <StatCard icon={<Star size={14} />} label="Best Score" value={`${stats.best_score}/100`} color="border-l-lime-400" />
            <StatCard icon={<Target size={14} />} label="Accuracy" value={`${stats.accuracy}%`} color="border-l-yellow-400" sub="Good codes %" />
            <StatCard icon={<User size={14} />} label="Reviews Done" value={stats.total_reviews} color="border-l-ink-200" />
            <StatCard icon={<Star size={14} />} label="Good Codes" value={stats.good_codes} color="border-l-lime-400" sub="Score ≥ 75" />
            <StatCard icon={<Shield size={14} />} label="Issues Found" value={stats.total_findings} color="border-l-red-400" />
          </div>

          {/* Quote */}
          {stats.quote && (
            <div className="card border-l-4 border-l-ink-200 dark:bg-gray-900 dark:border-gray-700">
              <div className="flex gap-2">
                <Quote size={16} className="text-ink-300 dark:text-gray-600 shrink-0 mt-0.5" />
                <p className="text-sm text-ink-600 dark:text-gray-400 italic">{stats.quote}</p>
              </div>
            </div>
          )}

          {/* Tip */}
          {stats.tip && (
            <div className="card border-l-4 border-l-blue-400 dark:bg-gray-900 dark:border-gray-700">
              <span className="text-xs font-semibold text-blue-500 uppercase tracking-wide">Today's Tip</span>
              <p className="text-sm text-ink-700 dark:text-gray-300 mt-1">{stats.tip}</p>
            </div>
          )}
        </div>
      )}

      {/* Account card */}
      <div className="card mb-6 dark:bg-gray-900 dark:border-gray-700">
        {/* Avatar section */}
        <div className="flex items-start gap-4 mb-5 pb-5 border-b border-ink-100 dark:border-gray-700">
          <div className="relative shrink-0">
            <div className="w-20 h-20 border-2 border-ink-200 dark:border-gray-600 overflow-hidden flex items-center justify-center bg-ink-50 dark:bg-gray-800">
              {avatarUrl || avatarSeed ? (
                <img
                  src={currentAvatar}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                  onError={() => setAvatarUrl('')}
                />
              ) : (
                <div className="w-full h-full bg-blue-400 flex items-center justify-center text-white text-2xl font-bold">
                  {user?.name?.[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-400 flex items-center justify-center text-white hover:bg-blue-500 transition-colors"
              title="Upload image">
              <Camera size={11} />
            </button>
            <input ref={fileRef} type="file" accept=".svg,.png,.jpg,.jpeg" className="hidden" onChange={handleFileUpload} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-ink-900 dark:text-white">{user?.name}</p>
            <p className="text-sm text-ink-400 dark:text-gray-500">{user?.email}</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {DICEBEAR_STYLES.slice(0, 4).map((style) => (
                <button key={style} onClick={() => { setAvatarStyle(style); setAvatarUrl('') }}
                  className={`text-xs px-2 py-0.5 border transition-colors ${
                    avatarStyle === style && !avatarUrl
                      ? 'bg-blue-400 text-white border-blue-500'
                      : 'bg-white dark:bg-gray-800 text-ink-600 dark:text-gray-400 border-ink-200 dark:border-gray-600 hover:border-blue-300'
                  }`}>
                  {style.split('-')[0]}
                </button>
              ))}
              <button onClick={randomizeAvatar}
                className="flex items-center gap-1 text-xs px-2 py-0.5 border border-ink-200 dark:border-gray-600 text-ink-600 dark:text-gray-400 hover:border-blue-300 bg-white dark:bg-gray-800 transition-colors">
                <RefreshCw size={10} /> Random
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleUpdateName} className="space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <User size={14} className="text-blue-400" />
            <span className="text-sm font-semibold text-ink-700 dark:text-gray-200">Display Name</span>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Name</label>
            <input className="input dark:bg-gray-800 dark:border-gray-600 dark:text-white" value={nameForm.name}
              onChange={(e) => setNameForm({ name: e.target.value })} placeholder="Your name" />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Email</label>
            <input className="input bg-ink-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-500 cursor-not-allowed" value={user?.email} disabled />
            <p className="text-xs text-ink-400 dark:text-gray-600 mt-1">Email cannot be changed</p>
          </div>
          <button type="submit" className="btn-primary flex items-center gap-2" disabled={savingName}>
            <Save size={13} /> {savingName ? 'Saving…' : 'Save Profile'}
          </button>
        </form>
      </div>

      {/* Change password */}
      <div className="card dark:bg-gray-900 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <Lock size={14} className="text-blue-400" />
          <span className="text-sm font-semibold text-ink-700 dark:text-gray-200">Change Password</span>
        </div>
        <form onSubmit={handleChangePw} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-ink-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Current Password</label>
            <div className="relative">
              <input className={`input dark:bg-gray-800 dark:border-gray-600 dark:text-white pr-10 ${pwErrors.current ? 'border-red-400' : ''}`}
                type={showPw ? 'text' : 'password'} value={pwForm.current_password}
                onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })}
                placeholder="••••••••" />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 dark:text-gray-500 dark:hover:text-white">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {pwErrors.current && <p className="text-red-500 text-xs mt-1">{pwErrors.current}</p>}
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">New Password</label>
            <input className={`input dark:bg-gray-800 dark:border-gray-600 dark:text-white ${pwErrors.new ? 'border-red-400' : ''}`}
              type={showPw ? 'text' : 'password'} value={pwForm.new_password}
              onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })}
              placeholder="Min 6 characters" />
            {pwErrors.new && <p className="text-red-500 text-xs mt-1">{pwErrors.new}</p>}
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Confirm New Password</label>
            <input className={`input dark:bg-gray-800 dark:border-gray-600 dark:text-white ${pwErrors.confirm ? 'border-red-400' : ''}`}
              type={showPw ? 'text' : 'password'} value={pwForm.confirm}
              onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
              placeholder="Repeat new password" />
            {pwErrors.confirm && <p className="text-red-500 text-xs mt-1">{pwErrors.confirm}</p>}
          </div>
          <button type="submit" className="btn-primary flex items-center gap-2" disabled={savingPw}>
            <Lock size={13} /> {savingPw ? 'Changing…' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
