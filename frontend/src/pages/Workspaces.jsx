import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { workspaceApi } from '../services/api'
import { useDialog } from '../components/Dialog'
import toast from 'react-hot-toast'
import { Plus, Users, ChevronRight, Trash2, LogIn } from 'lucide-react'
import NeonLoader from '../components/NeonLoader'

export default function Workspaces() {
  const dialog = useDialog()
  const [workspaces, setWorkspaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const nav = useNavigate()

  const load = async () => {
    try {
      const { data } = await workspaceApi.list()
      setWorkspaces(data)
    } catch { toast.error('Failed to load workspaces') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const create = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    try {
      const { data } = await workspaceApi.create(name.trim())
      nav(`/workspace/${data.id}`)
    } catch { toast.error('Create failed') }
  }

  const join = async (e) => {
    e.preventDefault()
    if (!code.trim()) return
    try {
      const { data } = await workspaceApi.join(code.trim())
      nav(`/workspace/${data.workspace_id}`)
    } catch (err) { toast.error(err.response?.data?.detail || 'Join failed') }
  }

  const remove = async (id, e) => {
    e.preventDefault(); e.stopPropagation()
    if (!(await dialog.confirm({ title: 'Delete workspace?', message: 'This deletes the workspace for everyone.', danger: true, confirmText: 'Delete' }))) return
    try {
      await workspaceApi.remove(id)
      setWorkspaces((p) => p.filter((w) => w.id !== id))
    } catch { toast.error('Only the owner can delete') }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Team Workspaces</h1>
          <p className="text-sm text-ink-400 mt-0.5">Isolated rooms for real-time collaborative coding</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <form onSubmit={create} className="card p-4 flex flex-col gap-3">
          <div className="text-sm font-semibold text-ink-900 flex items-center gap-2"><Plus size={15} /> New workspace</div>
          <input className="input" placeholder="Workspace name" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn-primary">Create</button>
        </form>
        <form onSubmit={join} className="card p-4 flex flex-col gap-3">
          <div className="text-sm font-semibold text-ink-900 flex items-center gap-2"><LogIn size={15} /> Join by invite code</div>
          <input className="input" placeholder="Paste invite code" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn-secondary">Join</button>
        </form>
      </div>

      {loading ? (
        <NeonLoader label="Loading workspaces…" className="py-16" />
      ) : workspaces.length === 0 ? (
        <p className="text-sm text-ink-400">No workspaces yet. Create one above to start collaborating.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {workspaces.map((w) => (
            <Link key={w.id} to={`/workspace/${w.id}`}
              className="card p-4 flex items-center justify-between hover:border-ink-300 transition">
              <div className="flex items-center gap-3">
                <Users size={16} className="text-ink-400" />
                <div>
                  <div className="text-sm font-semibold text-ink-900">{w.name}</div>
                  <div className="text-xs text-ink-400 capitalize">{w.role}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {w.role === 'owner' && (
                  <button onClick={(e) => remove(w.id, e)} className="text-ink-300 hover:text-red-500"><Trash2 size={15} /></button>
                )}
                <ChevronRight size={16} className="text-ink-300" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
