import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { reviewsApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import { Plus, Search, Trash2, ChevronRight, Calendar, Filter } from 'lucide-react'

const scoreColor = (s) => s >= 75 ? 'text-lime-500' : s >= 50 ? 'text-yellow-500' : 'text-red-500'
const scoreBg   = (s) => s >= 75 ? 'bg-lime-400'  : s >= 50 ? 'bg-yellow-400'   : 'bg-red-400'

export default function Dashboard() {
  const { user } = useAuth()
  const [reviews, setReviews] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ minScore: 0, maxScore: 100, showFilter: false })

  const fetchReviews = async (q = '', minScore = 0, maxScore = 100) => {
    try {
      const { data } = await reviewsApi.all(q, minScore, maxScore)
      setReviews(data)
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchReviews() }, [])

  const handleDelete = async (id, e) => {
    e.preventDefault()
    if (!confirm('Delete this review?')) return
    try {
      await reviewsApi.delete(id)
      setReviews((p) => p.filter((r) => r.id !== id))
    } catch { toast.error('Delete failed') }
  }

  const avg = reviews.length ? Math.round(reviews.reduce((a, r) => a + (r.review_score || 0), 0) / reviews.length) : 0

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Dashboard</h1>
          <p className="text-sm text-ink-400 mt-0.5">Welcome back, {user?.name}</p>
        </div>
        <Link to="/upload" className="btn-primary flex items-center gap-2">
          <Plus size={15} /> New Review
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="stat-box border-l-4 border-l-blue-400">
          <div className="text-2xl font-bold text-ink-900">{reviews.length}</div>
          <div className="text-xs text-ink-400 font-medium uppercase tracking-wide mt-0.5">Total Reviews</div>
        </div>
        <div className="stat-box border-l-4 border-l-lime-400">
          <div className={`text-2xl font-bold ${scoreColor(avg)}`}>{avg}</div>
          <div className="text-xs text-ink-400 font-medium uppercase tracking-wide mt-0.5">Avg Score</div>
        </div>
        <div className="stat-box border-l-4 border-l-ink-200">
          <div className="text-2xl font-bold text-ink-900">
            {reviews.filter((r) => (r.review_score || 0) >= 75).length}
          </div>
          <div className="text-xs text-ink-400 font-medium uppercase tracking-wide mt-0.5">High Quality</div>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-2 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input className="input pl-9" placeholder="Search reviews…" value={search}
            onChange={(e) => { setSearch(e.target.value); fetchReviews(e.target.value, filter.minScore, filter.maxScore) }} />
        </div>
        <button onClick={() => setFilter(f => ({ ...f, showFilter: !f.showFilter }))}
          className={`btn-ghost flex items-center gap-1.5 text-sm ${filter.showFilter ? 'bg-blue-50 border-blue-300 text-blue-600' : ''}`}>
          <Filter size={14} /> Filter
        </button>
      </div>

      {filter.showFilter && (
        <div className="card mb-5 flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs font-semibold text-ink-600 uppercase tracking-wide mb-1 block">Min Score</label>
            <input type="number" min="0" max="100" className="input w-24"
              value={filter.minScore}
              onChange={(e) => {
                const v = Number(e.target.value)
                setFilter(f => ({ ...f, minScore: v }))
                fetchReviews(search, v, filter.maxScore)
              }} />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-600 uppercase tracking-wide mb-1 block">Max Score</label>
            <input type="number" min="0" max="100" className="input w-24"
              value={filter.maxScore}
              onChange={(e) => {
                const v = Number(e.target.value)
                setFilter(f => ({ ...f, maxScore: v }))
                fetchReviews(search, filter.minScore, v)
              }} />
          </div>
          <button onClick={() => { setFilter({ minScore: 0, maxScore: 100, showFilter: true }); fetchReviews(search, 0, 100) }}
            className="btn-ghost text-sm">Reset</button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center text-ink-400 py-20 text-sm">Loading…</div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-ink-200">
          <p className="text-ink-400 text-sm mb-4">No reviews yet</p>
          <Link to="/upload" className="btn-primary inline-flex items-center gap-2">
            <Plus size={15} /> Submit Code
          </Link>
        </div>
      ) : (
        <div className="border border-ink-200 divide-y divide-ink-100">
          {reviews.map((r) => (
            <Link key={r.id} to={`/review/${r.id}`}
              className="flex items-center gap-4 px-4 py-3.5 bg-white hover:bg-ink-50 transition-colors group">
              {/* Score pill */}
              <div className={`${scoreBg(r.review_score)} w-10 h-10 flex items-center justify-center shrink-0`}>
                <span className="text-white text-sm font-bold">{Math.round(r.review_score ?? 0)}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-semibold text-ink-900 text-sm truncate">{r.project_name}</div>
                <div className="text-xs text-ink-400 truncate mt-0.5">{r.summary}</div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1 text-xs text-ink-300">
                  <Calendar size={11} />
                  {new Date(r.created_at).toLocaleDateString()}
                </div>
                <button onClick={(e) => handleDelete(r.id, e)}
                  className="p-1 text-ink-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                  <Trash2 size={14} />
                </button>
                <ChevronRight size={14} className="text-ink-300" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
