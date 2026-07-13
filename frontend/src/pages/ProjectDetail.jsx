import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { reviewsApi } from '../services/api'
import toast from 'react-hot-toast'
import { ArrowLeft, RefreshCw, ChevronRight } from 'lucide-react'

const scoreColor = (s) => s >= 75 ? 'text-lime-500' : s >= 50 ? 'text-yellow-500' : 'text-red-500'

export default function ProjectDetail() {
  const { projectId } = useParams()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchReviews = async () => {
    try {
      const { data } = await reviewsApi.getForProject(projectId)
      setReviews(data)
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetchReviews()
    const iv = setInterval(fetchReviews, 4000)
    return () => clearInterval(iv)
  }, [projectId])

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/dashboard" className="btn-ghost flex items-center gap-1.5 text-sm">
          <ArrowLeft size={14} /> Dashboard
        </Link>
        <h1 className="text-xl font-bold text-ink-900">Review History</h1>
      </div>

      {loading ? (
        <div className="text-center text-ink-400 py-20 text-sm">Loading…</div>
      ) : reviews.length === 0 ? (
        <div className="border border-ink-200 p-12 text-center">
          <RefreshCw size={22} className="mx-auto mb-3 text-blue-400 animate-spin" />
          <p className="text-ink-600 text-sm font-medium">Analysis in progress</p>
          <p className="text-ink-400 text-xs mt-1">Auto-refreshing every 4 seconds</p>
        </div>
      ) : (
        <div className="border border-ink-200 divide-y divide-ink-100">
          {reviews.map((r) => (
            <Link key={r.id} to={`/review/${r.id}`}
              className="flex items-center gap-4 px-4 py-3.5 bg-white hover:bg-ink-50 transition-colors group">
              <span className={`text-xl font-bold w-10 text-center ${scoreColor(r.review_score)}`}>
                {Math.round(r.review_score ?? 0)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-ink-700 truncate">{r.summary}</div>
                <div className="text-xs text-ink-300 mt-0.5">{new Date(r.created_at).toLocaleString()}</div>
              </div>
              <ChevronRight size={14} className="text-ink-300 group-hover:text-ink-600" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
