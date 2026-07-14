import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { projectsApi } from '../services/api'
import { useDialog } from '../components/Dialog'
import toast from 'react-hot-toast'
import { FolderGit2, GitBranch, Plus, ChevronRight, ChevronDown, FileCode, Calendar, Trash2, Loader2, ExternalLink } from 'lucide-react'

export default function Projects() {
  const dialog = useDialog()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(null)          // expanded project id
  const [files, setFiles] = useState({})          // projectId -> [files]
  const [filesLoading, setFilesLoading] = useState(false)

  const fetch = async () => {
    try {
      const { data } = await projectsApi.list()
      setProjects(data.filter((p) => p.upload_type === 'repo'))
    } catch { toast.error('Failed to load projects') }
    finally { setLoading(false) }
  }
  useEffect(() => { fetch() }, [])

  const toggle = async (id) => {
    if (open === id) { setOpen(null); return }
    setOpen(id)
    if (!files[id]) {
      setFilesLoading(true)
      try {
        const { data } = await projectsApi.files(id)
        setFiles((f) => ({ ...f, [id]: data }))
      } catch { toast.error('Failed to load files') }
      finally { setFilesLoading(false) }
    }
  }

  const remove = async (id, e) => {
    e.preventDefault(); e.stopPropagation()
    if (!(await dialog.confirm({ title: 'Delete project?', message: 'This removes the project and all its pulled files.', danger: true, confirmText: 'Delete' }))) return
    try {
      await projectsApi.delete(id)
      setProjects((p) => p.filter((x) => x.id !== id))
    } catch { toast.error('Delete failed') }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 flex items-center gap-2"><FolderGit2 size={22} className="text-blue-400" /> Projects</h1>
          <p className="text-sm text-ink-400 mt-0.5">Repositories you pulled in for review, with all their files in one place</p>
        </div>
        <Link to="/upload" className="btn-primary flex items-center gap-2">
          <GitBranch size={15} /> Pull Repo
        </Link>
      </div>

      {loading ? (
        <div className="text-center text-ink-400 py-20 text-sm">Loading…</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-ink-200">
          <FolderGit2 size={28} className="mx-auto mb-3 text-ink-300" />
          <p className="text-ink-400 text-sm mb-4">No repositories pulled yet</p>
          <Link to="/upload" className="btn-primary inline-flex items-center gap-2">
            <GitBranch size={15} /> Pull a Repo
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <div key={p.id} className="border border-ink-200 bg-white">
              <div className="flex items-center gap-3 px-4 py-3.5">
                <button onClick={() => toggle(p.id)} className="text-ink-400 hover:text-ink-900 shrink-0">
                  {open === p.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <div className="w-9 h-9 bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                  <FolderGit2 size={16} className="text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink-900 text-sm truncate">{p.project_name}</div>
                  <div className="text-xs text-ink-400 truncate mt-0.5 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1"><FileCode size={11} /> {p.file_count} files</span>
                    <span>· {p.language}</span>
                    <span>· {p.review_count} review{p.review_count === 1 ? '' : 's'}</span>
                    {p.repo_url && (
                      <a href={p.repo_url} target="_blank" rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-0.5 text-blue-400 hover:underline">
                        <ExternalLink size={10} /> source
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="flex items-center gap-1 text-xs text-ink-300">
                    <Calendar size={11} /> {new Date(p.created_at).toLocaleDateString()}
                  </span>
                  <Link to={`/project/${p.id}`} className="btn-ghost text-xs py-1 px-2.5">Open</Link>
                  <button onClick={(e) => remove(p.id, e)} className="p-1 text-ink-200 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {open === p.id && (
                <div className="border-t border-ink-100 bg-ink-50/50 px-4 py-2">
                  {filesLoading && !files[p.id] ? (
                    <div className="flex items-center gap-2 text-xs text-ink-400 py-2"><Loader2 size={12} className="animate-spin" /> Loading files…</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 py-1">
                      {(files[p.id] || []).map((f) => (
                        <div key={f.id} className="flex items-center gap-1.5 text-xs text-ink-600 py-0.5 truncate">
                          <FileCode size={11} className="text-ink-300 shrink-0" />
                          <span className="font-mono truncate">{f.path}</span>
                          <span className="text-ink-300 ml-auto shrink-0">{f.language}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
