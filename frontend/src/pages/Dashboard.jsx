import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { reviewsApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { useDialog } from '../components/Dialog'
import toast from 'react-hot-toast'
import { Plus, Search, Trash2, ChevronRight, Calendar, Filter, FolderGit2, FileCode } from 'lucide-react'
import NeonLoader from '../components/NeonLoader'

const scoreColor = (s) => s >= 75 ? 'text-lime-500' : s >= 50 ? 'text-yellow-500' : 'text-red-500'
const scoreBg   = (s) => s >= 75 ? 'bg-lime-400'  : s >= 50 ? 'bg-yellow-400'   : 'bg-red-400'

// Per-user local cache key so reviews render instantly from disk on revisit.
const cacheKey = (uid) => `dash:reviews:${uid || 'anon'}`

export default function Dashboard() {
  const { user } = useAuth()
  const dialog = useDialog()
  const [reviews, setReviews] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ minScore: 0, maxScore: 100, showFilter: false })

  // Fetch the full list once. Filtering/search happen locally (see `filtered`),
  // so typing in the filter never hits the network.
  const fetchReviews = async () => {
    try {
      const { data } = await reviewsApi.all()
      setReviews(data)
      try { localStorage.setItem(cacheKey(user?.id), JSON.stringify(data)) } catch { /* quota */ }
    } catch {
      // Only surface the error if we have nothing cached to show.
      if (!reviews.length) toast.error('Failed to load')
    }
    finally { setLoading(false) }
  }

  // Stale-while-revalidate: paint cached reviews immediately, then refresh.
  useEffect(() => {
    try {
      const cached = localStorage.getItem(cacheKey(user?.id))
      if (cached) { setReviews(JSON.parse(cached)); setLoading(false) }
    } catch { /* ignore */ }
    fetchReviews()
  }, [user?.id])

  // Instant, client-side filtering — no request per keystroke.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return reviews.filter((r) => {
      const s = r.review_score ?? 0
      if (s < filter.minScore || s > filter.maxScore) return false
      if (q && !(`${r.project_name || ''} ${r.summary || ''}`.toLowerCase().includes(q))) return false
      return true
    })
  }, [reviews, search, filter.minScore, filter.maxScore])

  const handleDelete = async (id, e) => {
    e.preventDefault()
    if (!(await dialog.confirm({ title: 'Delete review?', message: 'This permanently removes the review.', danger: true, confirmText: 'Delete' }))) return
    try {
      await reviewsApi.delete(id)
      setReviews((p) => {
        const next = p.filter((r) => r.id !== id)
        try { localStorage.setItem(cacheKey(user?.id), JSON.stringify(next)) } catch { /* quota */ }
        return next
      })
    } catch { toast.error('Delete failed') }
  }

  const avg = filtered.length ? Math.round(filtered.reduce((a, r) => a + (r.review_score || 0), 0) / filtered.length) : 0

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
          <div className="text-2xl font-bold text-ink-900">{filtered.length}</div>
          <div className="text-xs text-ink-400 font-medium uppercase tracking-wide mt-0.5">Total Reviews</div>
        </div>
        <div className="stat-box border-l-4 border-l-lime-400">
          <div className={`text-2xl font-bold ${scoreColor(avg)}`}>{avg}</div>
          <div className="text-xs text-ink-400 font-medium uppercase tracking-wide mt-0.5">Avg Score</div>
        </div>
        <div className="stat-box border-l-4 border-l-ink-200">
          <div className="text-2xl font-bold text-ink-900">
            {filtered.filter((r) => (r.review_score || 0) >= 75).length}
          </div>
          <div className="text-xs text-ink-400 font-medium uppercase tracking-wide mt-0.5">High Quality</div>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-2 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input className="input pl-9" placeholder="Search reviews…" value={search}
            onChange={(e) => setSearch(e.target.value)} />
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
              onChange={(e) => setFilter(f => ({ ...f, minScore: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-600 uppercase tracking-wide mb-1 block">Max Score</label>
            <input type="number" min="0" max="100" className="input w-24"
              value={filter.maxScore}
              onChange={(e) => setFilter(f => ({ ...f, maxScore: Number(e.target.value) }))} />
          </div>
          <button onClick={() => setFilter({ minScore: 0, maxScore: 100, showFilter: true })}
            className="btn-ghost text-sm">Reset</button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <NeonLoader label="Loading your reviews…" className="py-16" />
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-ink-200">
          <p className="text-ink-400 text-sm mb-4">{reviews.length ? 'No reviews match your filters' : 'No reviews yet'}</p>
          <Link to="/upload" className="btn-primary inline-flex items-center gap-2">
            <Plus size={15} /> Submit Code
          </Link>
        </div>
      ) : (
        <div className="border border-ink-200 divide-y divide-ink-100">
          {filtered.map((r) => (
            <Link key={r.id} to={`/review/${r.id}`}
              className="flex items-center gap-4 px-4 py-3.5 bg-white hover:bg-ink-50 transition-colors group">
              {/* Score pill */}
              <div className={`${scoreBg(r.review_score)} w-10 h-10 flex items-center justify-center shrink-0`}>
                <span className="text-white text-sm font-bold">{Math.round(r.review_score ?? 0)}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-semibold text-ink-900 text-sm truncate flex items-center gap-2">
                  {r.project_name}
                  {r.upload_type === 'repo' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-500 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-sm">
                      <FolderGit2 size={9} /> repo · <FileCode size={9} /> {r.file_count} files
                    </span>
                  )}
                </div>
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
