import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { projectsApi, reviewsApi, lintApi, suggestApi } from '../services/api'
import toast from 'react-hot-toast'
import { Upload as UploadIcon, FileCode, Code, GitBranch, Lock, ArrowLeft, AlertCircle, AlertTriangle, Info, CheckCircle, Loader2, Wand2, Copy, ChevronDown, ChevronUp } from 'lucide-react'
import CodeEditor from '../components/CodeEditor'
import NeonLoader from '../components/NeonLoader'

const LANGUAGES = ['python', 'javascript', 'typescript', 'java', 'cpp', 'c', 'go']

const SEV_CONFIG = {
  error:   { icon: AlertCircle,   cls: 'border-red-200 bg-red-50',    textCls: 'text-red-600',    label: 'ERR' },
  warning: { icon: AlertTriangle, cls: 'border-yellow-200 bg-yellow-50', textCls: 'text-yellow-700', label: 'WARN' },
  info:    { icon: Info,          cls: 'border-blue-200 bg-blue-50',  textCls: 'text-blue-600',  label: 'INFO' },
}

function LivePanel({ findings, loading, code }) {
  if (!code?.trim()) return null
  const errors   = findings.filter((f) => f.severity === 'error')
  const warnings = findings.filter((f) => f.severity === 'warning')
  const infos    = findings.filter((f) => f.severity === 'info')

  return (
    <div className="border border-ink-200">
      <div className="flex items-center justify-between px-3 py-2 bg-ink-50 border-b border-ink-200">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-ink-700 uppercase tracking-wide">Live Review</span>
          {loading && <Loader2 size={11} className="text-blue-400 animate-spin" />}
        </div>
        <div className="flex items-center gap-3 text-xs">
          {errors.length   > 0 && <span className="text-red-600 font-semibold">{errors.length} errors</span>}
          {warnings.length > 0 && <span className="text-yellow-600 font-semibold">{warnings.length} warnings</span>}
          {infos.length    > 0 && <span className="text-blue-500">{infos.length} info</span>}
          {!loading && findings.length === 0 && (
            <span className="flex items-center gap-1 text-lime-500 font-medium">
              <CheckCircle size={11} /> Clean
            </span>
          )}
        </div>
      </div>
      {findings.length > 0 && (
        <div className="divide-y divide-ink-100 max-h-40 overflow-y-auto">
          {findings.map((f, i) => {
            const cfg = SEV_CONFIG[f.severity] || SEV_CONFIG.info
            const Icon = cfg.icon
            return (
              <div key={i} className={`flex items-start gap-2 px-3 py-1.5 border-l-2 ${cfg.cls}`}>
                <Icon size={11} className={`mt-0.5 shrink-0 ${cfg.textCls}`} />
                <span className="font-mono text-ink-400 shrink-0 w-8 text-xs">L{f.line}</span>
                <span className={`font-mono text-xs shrink-0 ${cfg.textCls}`}>{f.symbol}</span>
                <span className="text-ink-700 text-xs leading-tight">{f.message}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SuggestionsPanel({ code, language }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [open, setOpen] = useState(false)
  const [focus, setFocus] = useState('')

  const run = async () => {
    if (!code?.trim()) { toast.error('No code to analyse'); return }
    setLoading(true)
    setOpen(true)
    try {
      const { data } = await suggestApi.code(code, language, focus)
      setResult(data)
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
    <div className="border border-ink-200">
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
          {result.error && (
            <p className="text-red-500 text-xs">{result.error}</p>
          )}
          {result.summary && (
            <p className="text-xs text-ink-600 italic">{result.summary}</p>
          )}
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

export default function Upload() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('snippet')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ project_name: '', code: '', language: 'python' })
  const [repo, setRepo] = useState({ repo_url: '', branch: '', token: '' })
  const [showToken, setShowToken] = useState(false)
  const [file, setFile] = useState(null)
  const [lintFindings, setLintFindings] = useState([])
  const [lintLoading, setLintLoading] = useState(false)
  const debounceRef = useRef(null)

  const onDrop = useCallback((accepted) => { if (accepted[0]) setFile(accepted[0]) }, [])
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/plain': ['.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.cpp', '.c', '.go'] },
    maxFiles: 1,
  })

  const runLive = useCallback((code, language) => {
    if (!code?.trim()) { setLintFindings([]); return }
    setLintLoading(true)
    lintApi.live(code, language)
      .then(({ data }) => setLintFindings(data.findings || []))
      .catch(() => {})
      .finally(() => setLintLoading(false))
  }, [])

  useEffect(() => {
    if (mode !== 'snippet') return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runLive(form.code, form.language), 600)
    return () => clearTimeout(debounceRef.current)
  }, [form.code, form.language, mode, runLive])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (mode !== 'repo' && !form.project_name.trim()) { toast.error('Project name required'); return }
    setLoading(true)
    try {
      let res
      if (mode === 'snippet') {
        if (!form.code.trim()) { toast.error('Paste some code'); setLoading(false); return }
        res = await projectsApi.submitSnippet({ project_name: form.project_name, code: form.code, language: form.language })
      } else if (mode === 'repo') {
        if (!repo.repo_url.trim()) { toast.error('Repo URL required'); setLoading(false); return }
        res = await projectsApi.submitRepo({
          repo_url: repo.repo_url.trim(),
          project_name: form.project_name,
          branch: repo.branch.trim(),
          token: repo.token.trim(),
        })
        if (res.data.truncated) toast('Large repo — only the first files were pulled', { icon: '✂️' })
        toast.success(`Pulled ${res.data.file_count} files`)
      } else {
        if (!file) { toast.error('Select a file'); setLoading(false); return }
        const fd = new FormData()
        fd.append('project_name', form.project_name)
        fd.append('file', file)
        res = await projectsApi.submitFile(fd)
      }
      await reviewsApi.trigger(res.data.id)
      toast.success('Analysis started')
      navigate(`/project/${res.data.id}`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Submit failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/dashboard" className="btn-ghost flex items-center gap-1.5 text-sm">
          <ArrowLeft size={14} /> Back
        </Link>
        <div>
          <h1 className="text-xl font-bold text-ink-900">Submit Code</h1>
          <p className="text-xs text-ink-400 mt-0.5">Run AI + static analysis on your code</p>
        </div>
      </div>

      <div className="flex border border-ink-200 mb-6 w-fit">
        {[['snippet', Code, 'Paste Snippet'], ['file', FileCode, 'Upload File'], ['repo', GitBranch, 'Pull Repo']].map(([m, Icon, label]) => (
          <button key={m} onClick={() => setMode(m)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors ${
              mode === m ? 'bg-blue-400 text-white' : 'bg-white text-ink-600 hover:bg-ink-50'
            }`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card">
          <label className="text-xs font-semibold text-ink-600 uppercase tracking-wide mb-1.5 block">
            Project Name {mode === 'repo' && <span className="text-ink-300 normal-case">(optional — defaults to repo name)</span>}
          </label>
          <input className="input" value={form.project_name} required={mode !== 'repo'}
            onChange={(e) => setForm({ ...form, project_name: e.target.value })}
            placeholder="e.g. Auth Service v2" />
        </div>

        {mode === 'repo' ? (
          <div className="card space-y-4">
            <div>
              <label className="text-xs font-semibold text-ink-600 uppercase tracking-wide mb-1.5 block">Git Repo URL</label>
              <input className="input font-mono text-sm" value={repo.repo_url}
                autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
                name="git-repo-url" type="url" inputMode="url"
                onChange={(e) => setRepo({ ...repo, repo_url: e.target.value })}
                placeholder="https://github.com/user/repo" />
              <p className="text-ink-300 text-xs mt-1">Small projects only — up to 40 source files pulled via a shallow clone.</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-600 uppercase tracking-wide mb-1.5 block">Branch <span className="text-ink-300 normal-case">(optional)</span></label>
              <input className="input" value={repo.branch} autoComplete="off"
                onChange={(e) => setRepo({ ...repo, branch: e.target.value })}
                placeholder="main (leave blank for default)" />
            </div>

            {/* Token hidden by default — confidential, only for private repos */}
            {!showToken ? (
              <button type="button" onClick={() => setShowToken(true)}
                className="flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink-700">
                <Lock size={12} /> Private repo? Add a secured access token
              </button>
            ) : (
              <div>
                <label className="text-xs font-semibold text-ink-600 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                  <Lock size={12} /> Access Token <span className="text-ink-300 normal-case">(confidential — private repos only)</span>
                </label>
                <input className="input" type="password" value={repo.token} autoComplete="new-password"
                  onChange={(e) => setRepo({ ...repo, token: e.target.value })}
                  placeholder="ghp_…" />
                <button type="button" onClick={() => { setShowToken(false); setRepo({ ...repo, token: '' }) }}
                  className="text-xs text-ink-300 hover:text-ink-500 mt-1">Hide</button>
              </div>
            )}
          </div>
        ) : mode === 'snippet' ? (
          <div className="card space-y-4">
            <div>
              <label className="text-xs font-semibold text-ink-600 uppercase tracking-wide mb-1.5 block">Language</label>
              <select className="input" value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}>
                {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-600 uppercase tracking-wide mb-1.5 block">Code</label>
              <div className="border border-ink-200">
                <CodeEditor
                  value={form.code}
                  onChange={(v) => setForm({ ...form, code: v || '' })}
                  language={form.language}
                  lintFindings={lintFindings}
                  height="380px"
                />
              </div>
            </div>
            <LivePanel findings={lintFindings} loading={lintLoading} code={form.code} />
            <SuggestionsPanel code={form.code} language={form.language} />
          </div>
        ) : (
          <div className="card">
            <div {...getRootProps()}
              className={`border-2 border-dashed p-12 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-blue-400 bg-blue-50' : 'border-ink-200 hover:border-ink-400'
              }`}>
              <input {...getInputProps()} />
              <UploadIcon size={28} className="mx-auto mb-3 text-ink-300" />
              {file ? (
                <p className="text-blue-500 font-semibold text-sm">{file.name}</p>
              ) : (
                <>
                  <p className="text-ink-600 text-sm font-medium">Drop file or click to browse</p>
                  <p className="text-ink-300 text-xs mt-1">.py .js .ts .jsx .tsx .java .cpp .c .go</p>
                </>
              )}
            </div>
          </div>
        )}

        <button type="submit" className="btn-lime w-full flex items-center justify-center gap-2" disabled={loading}>
          {loading && <NeonLoader inline width={40} label="" />}
          {loading ? 'Submitting…' : '▶  Analyse Code'}
        </button>
      </form>
    </div>
  )
}
