import { useEffect, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { reviewsApi, reportsApi, suggestApi, lintApi, workspaceApi } from '../services/api'
import toast from 'react-hot-toast'
import { ArrowLeft, Download, FileText, AlertTriangle, ShieldAlert, Zap, Code2, BookOpen, BarChart3, Wand2, Copy, ChevronDown, ChevronUp, Loader2, Users } from 'lucide-react'
import ScoreRing from '../components/ScoreRing'
import CodeEditor from '../components/CodeEditor'
import NeonLoader from '../components/NeonLoader'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'

const SEVERITY_BADGE = { high: 'badge-high', medium: 'badge-medium', low: 'badge-low', info: 'badge-info' }

const TABS = [
  ['overview',   'Overview'],
  ['findings',   'Findings'],
  ['static',     'Built-in'],
  ['complexity', 'Complexity'],
  ['docs',       'Docs'],
  ['code',       'Code'],
]

function TabBtn({ id, label, active, onClick, count }) {
  return (
    <button onClick={() => onClick(id)}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active ? 'border-blue-400 text-blue-500' : 'border-transparent text-ink-400 hover:text-ink-700'
      }`}>
      {label}{count !== undefined ? ` (${count})` : ''}
    </button>
  )
}

function FindingRow({ f }) {
  return (
    <div className="border border-ink-100 p-3 bg-white hover:bg-ink-50 transition-colors">
      <div className="flex items-start gap-3">
        <span className={SEVERITY_BADGE[f.severity] || 'badge-info'}>{f.severity}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-ink-800 font-medium">{f.issue}</p>
          {f.suggestion && <p className="text-xs text-ink-400 mt-1">→ {f.suggestion}</p>}
          {f.line_number && <p className="text-xs text-ink-300 mt-0.5">Line {f.line_number}</p>}
        </div>
      </div>
    </div>
  )
}

function CodeSuggestionsPanel({ code, language }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [open, setOpen] = useState(false)
  const [focus, setFocus] = useState('')

  const run = async () => {
    if (!code?.trim()) { toast.error('No code to analyse'); return }
    setLoading(true)
    setOpen(true)
    try {
      const { data } = await suggestApi.code(code, language || 'python', focus)
      setResult(data)
      setOpen(true)
    } catch {
      toast.error('Suggestion failed')
    } finally {
      setLoading(false)
    }
  }

  const copy = () => {
    if (result?.improved_code) {
      navigator.clipboard.writeText(result.improved_code)
      toast.success('Copied!')
    }
  }

  return (
    <div className="border border-ink-200 mt-3">
      <div className="flex items-center gap-2 px-3 py-2 bg-ink-50 border-b border-ink-200">
        <Wand2 size={13} className="text-blue-400" />
        <span className="text-xs font-semibold text-ink-700 uppercase tracking-wide flex-1">AI Code Suggestions</span>
        <input
          className="input text-xs py-1 px-2 w-48"
          placeholder="Focus: e.g. performance"
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
        />
        <button onClick={run} disabled={loading}
          className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5">
          {loading ? <NeonLoader inline width={34} label="" /> : <Wand2 size={11} />}
          {loading ? 'Analysing…' : 'Suggest'}
        </button>
        {result && (
          <button onClick={() => setOpen(!open)} className="text-ink-400 hover:text-ink-700">
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>
      {open && result && (
        <div className="p-3 space-y-3">
          {result.error && <p className="text-red-500 text-xs">{result.error}</p>}
          {result.summary && <p className="text-xs text-ink-600 italic">{result.summary}</p>}
          {(result.time_complexity || result.space_complexity) && (
            <div className="flex gap-4 text-xs">
              {result.time_complexity && (
                <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 font-mono">
                  Time: {result.time_complexity}
                </span>
              )}
              {result.space_complexity && (
                <span className="px-2 py-0.5 bg-lime-50 border border-lime-200 text-lime-700 font-mono">
                  Space: {result.space_complexity}
                </span>
              )}
            </div>
          )}
          {result.changes?.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-ink-600 uppercase tracking-wide">Changes</p>
              {result.changes.map((c, i) => (
                <div key={i} className="border border-ink-100 p-2 text-xs">
                  {c.line && <span className="text-ink-300 mr-2">L{c.line}</span>}
                  {c.original && <code className="text-red-500 line-through mr-2">{c.original}</code>}
                  {c.suggested && <code className="text-lime-600">{c.suggested}</code>}
                  {c.reason && <p className="text-ink-400 mt-0.5">{c.reason}</p>}
                </div>
              ))}
            </div>
          )}
          {result.improved_code && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-ink-600 uppercase tracking-wide">Improved Code</p>
                <button onClick={copy} className="flex items-center gap-1 text-xs text-ink-400 hover:text-ink-700">
                  <Copy size={11} /> Copy
                </button>
              </div>
              <pre className="text-xs font-mono bg-ink-50 border border-ink-200 p-3 overflow-auto max-h-64 whitespace-pre-wrap leading-relaxed">
                {result.improved_code}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Section({ icon, title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-ink-200">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-ink-50 hover:bg-ink-100 transition-colors">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink-800">{icon}{title}</div>
        <span className="text-ink-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="p-4 space-y-2">{children}</div>}
    </div>
  )
}

export default function ReviewDetail() {
  const { reviewId } = useParams()
  const navigate = useNavigate()
  const [review, setReview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')
  const [editableCode, setEditableCode] = useState('')
  const [rerunLoading, setRerunLoading] = useState(false)
  const [collabLoading, setCollabLoading] = useState(false)
  const [liveLintFindings, setLiveLintFindings] = useState([])
  const [pdfMenuOpen, setPdfMenuOpen] = useState(false)
  const debounceRef = useRef(null)
  const pdfMenuRef = useRef(null)

  useEffect(() => {
    reviewsApi.getById(reviewId)
      .then(({ data }) => { setReview(data); setEditableCode(data.code || '') })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false))
  }, [reviewId])

  useEffect(() => {
    const handler = (e) => { if (pdfMenuRef.current && !pdfMenuRef.current.contains(e.target)) setPdfMenuOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!editableCode?.trim()) { setLiveLintFindings([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      lintApi.live(editableCode, review?.language || 'python')
        .then(({ data }) => setLiveLintFindings(data.findings || []))
        .catch(() => {})
    }, 800)
    return () => clearTimeout(debounceRef.current)
  }, [editableCode, review?.language])

  const downloadPdf = async () => {
    try {
      const { data } = await reportsApi.pdf(reviewId)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([data]))
      a.download = `review_${reviewId}.pdf`; a.click()
    } catch { toast.error('PDF export failed') }
  }

  const downloadMd = async () => {
    try {
      const { data } = await reportsApi.markdown(reviewId)
      const a = document.createElement('a')
      a.href = `data:text/markdown;charset=utf-8,${encodeURIComponent(data)}`
      a.download = `review_${reviewId}.md`; a.click()
    } catch { toast.error('Markdown export failed') }
  }

  const downloadExecutivePdf = async () => {
    try {
      const { data } = await reportsApi.pdfExecutive(reviewId)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([data]))
      a.download = `executive_summary_${reviewId}.pdf`; a.click()
    } catch { toast.error('PDF export failed') }
  }

  const downloadSecurityPdf = async () => {
    try {
      const { data } = await reportsApi.pdfSecurity(reviewId)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([data]))
      a.download = `security_report_${reviewId}.pdf`; a.click()
    } catch { toast.error('PDF export failed') }
  }

  const downloadComplexityPdf = async () => {
    try {
      const { data } = await reportsApi.pdfComplexity(reviewId)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([data]))
      a.download = `complexity_report_${reviewId}.pdf`; a.click()
    } catch { toast.error('PDF export failed') }
  }

  const downloadHtml = async () => {
    try {
      const { data } = await reportsApi.html(reviewId)
      const a = document.createElement('a')
      a.href = `data:text/html;charset=utf-8,${encodeURIComponent(data)}`
      a.download = `review_${reviewId}.html`; a.click()
    } catch { toast.error('HTML export failed') }
  }

  const handleRerun = async () => {
    if (!editableCode?.trim()) { toast.error('No code to analyse'); return }
    setRerunLoading(true)
    try {
      await reviewsApi.rerun(reviewId, editableCode)
      toast.success('Re-analysis started! Refresh in a few seconds.')
      setTimeout(() => {
        reviewsApi.getById(reviewId).then(({ data }) => { setReview(data); setEditableCode(data.code || '') })
      }, 3000)
    } catch {
      toast.error('Re-run failed')
    } finally {
      setRerunLoading(false)
    }
  }

  // Turn the current file into a live team workspace, seeded with the edited code.
  const startCollab = async () => {
    setCollabLoading(true)
    try {
      const { data: ws } = await workspaceApi.create(`${review.project_name} (live)`)
      const name = `${review.project_name || 'main'}.${(review.language || 'py') === 'python' ? 'py' : review.language}`
      await workspaceApi.createFile(ws.id, name, review.language || 'python', editableCode || '')
      toast.success('Collaboration room ready — invite your team!')
      navigate(`/workspace/${ws.id}`)
    } catch {
      toast.error('Could not start collaboration')
    } finally {
      setCollabLoading(false)
    }
  }

  if (loading) return <div className="py-20"><NeonLoader label="Loading review…" /></div>
  if (!review)  return <div className="text-center text-red-500 py-20 text-sm">Review not found</div>

  const ai = review.ai_review || {}
  const cx = review.complexity_metrics || {}
  const findings = review.findings || []
  const high   = findings.filter((f) => f.severity === 'high').length
  const medium = findings.filter((f) => f.severity === 'medium').length
  const low    = findings.filter((f) => f.severity === 'low').length

  const radarData = [
    { subject: 'Quality',        value: review.review_score ?? 0 },
    { subject: 'Security',       value: Math.max(0, 100 - high * 20 - medium * 10) },
    { subject: 'Complexity',     value: Math.min(100, Math.max(0, 100 - (cx.cyclomatic_complexity || 0) * 5)) },
    { subject: 'Maintainability',value: cx.maintainability_index ?? 50 },
    { subject: 'Style',          value: Math.max(0, 100 - low * 5) },
  ]

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="btn-ghost flex items-center gap-1.5 text-sm">
            <ArrowLeft size={14} /> Back
          </Link>
          <div>
            <h1 className="text-lg font-bold text-ink-900">{review.project_name}</h1>
            <p className="text-xs text-ink-400">{new Date(review.created_at).toLocaleString()}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadMd} className="btn-ghost flex items-center gap-1.5 text-sm">
            <FileText size={14} /> Markdown
          </button>
          <button onClick={downloadHtml} className="btn-ghost flex items-center gap-1.5 text-sm">
            <Code2 size={14} /> HTML
          </button>
          <div className="relative" ref={pdfMenuRef}>
            <button
              onClick={() => setPdfMenuOpen(!pdfMenuOpen)}
              className="btn-primary flex items-center gap-1.5 text-sm"
            >
              <Download size={14} /> PDF <ChevronDown size={12} className={`transition-transform ${pdfMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {pdfMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-ink-200 shadow-lg z-50 dark:bg-gray-900 dark:border-gray-700">
                {[
                  ['Full Review Report', downloadPdf],
                  ['Executive Summary', downloadExecutivePdf],
                  ['Security Report', downloadSecurityPdf],
                  ['Complexity Analysis', downloadComplexityPdf],
                ].map(([label, fn]) => (
                  <button key={label} onClick={() => { fn(); setPdfMenuOpen(false) }}
                    className="w-full text-left px-4 py-2.5 text-sm text-ink-700 hover:bg-ink-50 transition-colors dark:text-gray-200 dark:hover:bg-gray-800 flex items-center gap-2">
                    <FileText size={12} className="text-ink-400" /> {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-ink-200 mb-6 overflow-x-auto">
        {TABS.map(([id, label]) => (
          <TabBtn key={id} id={id} label={label}
            count={id === 'findings' ? findings.length : undefined}
            active={tab === id} onClick={setTab} />
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="card flex flex-wrap items-start gap-8">
            <ScoreRing score={review.review_score} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-ink-700 leading-relaxed">{review.summary}</p>
              <div className="flex gap-4 mt-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-red-500">{high}</div>
                  <div className="text-xs text-ink-400">High</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-yellow-500">{medium}</div>
                  <div className="text-xs text-ink-400">Medium</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-400">{low}</div>
                  <div className="text-xs text-ink-400">Low</div>
                </div>
              </div>
            </div>
            <div className="w-52 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#d4d4d8" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#9898a3', fontSize: 10 }} />
                  <Radar dataKey="value" fill="#4361EE" fillOpacity={0.2} stroke="#4361EE" strokeWidth={1.5} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #d4d4d8', fontSize: 11 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
          {ai.improvements_summary && (
            <div className="card border-l-4 border-l-lime-400">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={14} className="text-lime-500" />
                <span className="text-xs font-semibold text-ink-600 uppercase tracking-wide">Top Improvements</span>
              </div>
              <p className="text-sm text-ink-700">{ai.improvements_summary}</p>
            </div>
          )}
        </div>
      )}

      {/* Findings */}
      {tab === 'findings' && (
        <div className="space-y-4">
          {[
            ['Bugs',            'bugs',            <AlertTriangle size={14} className="text-red-500" />],
            ['Security Issues', 'security_issues', <ShieldAlert   size={14} className="text-orange-500" />],
            ['Code Smells',     'code_smells',     <Code2         size={14} className="text-yellow-500" />],
            ['Performance',     'performance',     <Zap           size={14} className="text-blue-400" />],
          ].map(([title, key, icon]) =>
            ai[key]?.length > 0 && (
              <Section key={key} icon={icon} title={`${title} (${ai[key].length})`}>
                {ai[key].map((item, i) => (
                  <FindingRow key={i} f={{ ...item,
                    severity: key === 'bugs' ? 'high' : key === 'security_issues' ? (item.severity || 'medium') : 'low'
                  }} />
                ))}
              </Section>
            )
          )}
          {ai.naming_suggestions?.length > 0 && (
            <Section icon={<Code2 size={14} className="text-ink-500" />} title={`Naming (${ai.naming_suggestions.length})`}>
              {ai.naming_suggestions.map((n, i) => (
                <div key={i} className="border border-ink-100 p-3 text-sm">
                  <code className="text-red-500 line-through mr-2">{n.original}</code>
                  <span className="text-ink-400 mr-2">→</span>
                  <code className="text-lime-600">{n.suggested}</code>
                  <p className="text-xs text-ink-400 mt-1">{n.reason}</p>
                </div>
              ))}
            </Section>
          )}
        </div>
      )}

      {/* Built-in Static Analysis */}
      {tab === 'static' && (() => {
        const sa = review.static_analysis || {}
        const pylint = sa.pylint || {}
        const bandit = sa.bandit || {}
        const pylintFindings = pylint.findings || []
        const banditFindings = bandit.findings || []
        const noData = pylintFindings.length === 0 && banditFindings.length === 0

        const sevBadge = (sev) => ({
          high: 'badge-high', medium: 'badge-medium', low: 'badge-low',
        }[sev] || 'badge-info')

        return (
          <div className="space-y-4">
            {pylint.error && (
              <div className="card border-l-4 border-l-yellow-400 text-sm text-ink-600">
                Pylint error: {pylint.error}
              </div>
            )}
            {bandit.error && (
              <div className="card border-l-4 border-l-yellow-400 text-sm text-ink-600">
                Bandit error: {bandit.error}
              </div>
            )}
            {pylintFindings.length > 0 && (
              <Section icon={<Code2 size={14} className="text-blue-400" />}
                title={`Pylint (${pylintFindings.length}) — score: ${pylint.score ?? '?'}/10`}>
                {pylintFindings.map((f, i) => (
                  <div key={i} className="border border-ink-100 p-3 bg-white hover:bg-ink-50 transition-colors">
                    <div className="flex items-start gap-3">
                      <span className={sevBadge(f.severity)}>{f.severity}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-ink-500">{f.symbol}</p>
                        <p className="text-sm text-ink-800">{f.message}</p>
                        {f.line > 0 && <p className="text-xs text-ink-300 mt-0.5">Line {f.line}, Col {f.column}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </Section>
            )}
            {banditFindings.length > 0 && (
              <Section icon={<ShieldAlert size={14} className="text-orange-500" />}
                title={`Bandit Security (${banditFindings.length})`}>
                {banditFindings.map((f, i) => (
                  <div key={i} className="border border-ink-100 p-3 bg-white hover:bg-ink-50 transition-colors">
                    <div className="flex items-start gap-3">
                      <span className={sevBadge(f.severity)}>{f.severity}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-ink-500">{f.test_id} · {f.test_name}</p>
                        <p className="text-sm text-ink-800">{f.issue}</p>
                        {f.line > 0 && <p className="text-xs text-ink-300 mt-0.5">Line {f.line}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </Section>
            )}
            {noData && !pylint.error && !bandit.error && (
              <div className="text-center py-16 text-ink-400 text-sm">
                No static analysis data. Only available for Python code.
              </div>
            )}
          </div>
        )
      })()}

      {/* Complexity */}
      {tab === 'complexity' && (
        <div className="space-y-5">
          {/* AI Time/Space Complexity */}
          {(ai.time_complexity || ai.space_complexity) && (
            <div className="card border-l-4 border-l-blue-400">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={14} className="text-blue-400" />
                <span className="text-xs font-semibold text-ink-600 uppercase tracking-wide">AI Complexity Analysis</span>
              </div>
              <div className="flex flex-wrap gap-6 mb-3">
                {ai.time_complexity && (
                  <div>
                    <div className="text-xs text-ink-400 mb-0.5 uppercase tracking-wide">Time</div>
                    <code className="text-xl font-bold text-blue-500">{ai.time_complexity}</code>
                  </div>
                )}
                {ai.space_complexity && (
                  <div>
                    <div className="text-xs text-ink-400 mb-0.5 uppercase tracking-wide">Space</div>
                    <code className="text-xl font-bold text-lime-500">{ai.space_complexity}</code>
                  </div>
                )}
              </div>
              {ai.complexity_explanation && (
                <p className="text-sm text-ink-600">{ai.complexity_explanation}</p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              ['Cyclomatic Complexity', cx.cyclomatic_complexity ?? '—'],
              ['Maintainability Index', cx.maintainability_index?.toFixed(1) ?? '—'],
              ['Lines of Code',         cx.loc ?? '—'],
              ['Source Lines',          cx.sloc ?? '—'],
              ['Classes',               cx.num_classes ?? '—'],
              ['Functions',             cx.num_functions ?? '—'],
              ['Avg Fn Length',         cx.avg_function_length ?? '—'],
            ].map(([label, value]) => (
              <div key={label} className="stat-box border-t-2 border-t-blue-400">
                <div className="text-2xl font-bold text-ink-900">{value}</div>
                <div className="text-xs text-ink-400 font-medium uppercase tracking-wide mt-0.5">{label}</div>
              </div>
            ))}
          </div>
          {cx.functions?.length > 0 && (
            <Section icon={<BarChart3 size={14} className="text-blue-400" />} title="Function Complexity">
              {cx.functions.map((fn, i) => (
                <div key={i} className="flex items-center justify-between text-sm border border-ink-100 px-3 py-2 bg-white">
                  <span className="font-mono text-ink-700 text-xs">{fn.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-ink-400">cc: {fn.complexity}</span>
                    <span className={`tag font-bold ${
                      fn.rank === 'A' ? 'bg-lime-50 text-lime-600 border-lime-200'
                      : fn.rank === 'B' ? 'bg-yellow-50 text-yellow-600 border-yellow-200'
                      : 'bg-red-50 text-red-600 border-red-200'}`}>
                      {fn.rank}
                    </span>
                  </div>
                </div>
              ))}
            </Section>
          )}
        </div>
      )}

      {/* Docs */}
      {tab === 'docs' && (
        <div className="border border-ink-200">
          <div className="flex items-center gap-2 px-4 py-3 bg-ink-50 border-b border-ink-200">
            <BookOpen size={14} className="text-blue-400" />
            <span className="text-sm font-semibold text-ink-700">Generated Documentation</span>
          </div>
          <pre className="text-xs text-ink-700 font-mono whitespace-pre-wrap p-5 overflow-auto max-h-[60vh] leading-relaxed">
            {review.documentation || 'No documentation generated'}
          </pre>
        </div>
      )}

      {/* Code */}
      {tab === 'code' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-ink-400">Edit code below and click Re-Run Analysis to analyze changes</span>
            <div className="flex gap-2">
              <button
                onClick={startCollab}
                disabled={collabLoading}
                className="btn-ghost flex items-center gap-1.5 text-sm"
                title="Open this file in a real-time team workspace"
              >
                {collabLoading ? <Loader2 size={13} className="animate-spin" /> : <Users size={13} />}
                {collabLoading ? 'Starting…' : 'Collaborate'}
              </button>
              <button
                onClick={handleRerun}
                disabled={rerunLoading}
                className="btn-lime flex items-center gap-1.5 text-sm"
              >
                {rerunLoading ? <NeonLoader inline width={38} label="" /> : <Zap size={13} />}
                {rerunLoading ? 'Running…' : 'Re-Run Analysis'}
              </button>
            </div>
          </div>
          <div className="border border-ink-200">
            <CodeEditor
              value={editableCode}
              onChange={(v) => setEditableCode(v || '')}
              language={review.language || 'python'}
              lintFindings={liveLintFindings}
              height="500px"
            />
          </div>
          <CodeSuggestionsPanel code={editableCode} language={review.language} />
        </div>
      )}
    </div>
  )
}
