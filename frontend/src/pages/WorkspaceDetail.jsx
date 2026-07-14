import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { workspaceApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { createCollab, colorFor } from '../services/collab'
import CollabEditor from '../components/CollabEditor'
import toast from 'react-hot-toast'
import { ArrowLeft, Plus, GitBranch, File, Trash2, Users, Link2, Wifi, WifiOff, Check, History, X } from 'lucide-react'

const LANGS = ['python', 'javascript', 'typescript', 'java', 'cpp', 'go']

export default function WorkspaceDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [ws, setWs] = useState(null)
  const [activeFile, setActiveFile] = useState(null)   // {id, name, language}
  const [collab, setCollab] = useState(null)
  const [peers, setPeers] = useState([])
  const [connected, setConnected] = useState(false)
  const [saved, setSaved] = useState(true)
  const [invEmail, setInvEmail] = useState('')
  const [copied, setCopied] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [changes, setChanges] = useState([])

  const collabRef = useRef(null)
  const saveTimer = useRef(null)

  const loadWs = async () => {
    try {
      const { data } = await workspaceApi.get(id)
      setWs(data)
      if (!activeFile && data.files?.length) openFile(data.files[0])
    } catch (e) { toast.error(e.response?.data?.detail || 'Access denied') }
  }
  useEffect(() => { loadWs() }, [id])

  const loadChanges = async () => {
    try {
      const { data } = await workspaceApi.changes(id)
      setChanges(data)
    } catch { /* ignore */ }
  }
  const toggleHistory = () => {
    const next = !showHistory
    setShowHistory(next)
    if (next) loadChanges()
  }
  const historyOpenRef = useRef(false)
  historyOpenRef.current = showHistory

  // Tear down current collab session
  const teardown = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    collabRef.current?.destroy()
    collabRef.current = null
    setCollab(null); setPeers([]); setConnected(false)
  }
  useEffect(() => () => teardown(), [])

  const isViewer = ws?.role === 'viewer'

  const openFile = async (f) => {
    teardown()
    setActiveFile(f)
    let snapshot = ''
    let seed = ''
    try {
      const { data } = await workspaceApi.getFile(id, f.id)
      snapshot = data.ydoc_snapshot || ''
      seed = data.content || ''
    } catch { /* new/empty file */ }

    const c = createCollab(`${id}:${f.id}`, user, snapshot, seed)
    collabRef.current = c
    setCollab(c)

    c.provider.on('status', (e) => setConnected(e.status === 'connected'))
    const updatePeers = () => {
      const list = []
      c.awareness.getStates().forEach((s) => { if (s.user) list.push(s.user) })
      setPeers(list)
    }
    c.awareness.on('change', updatePeers); updatePeers()

    // Debounced autosave: push CRDT snapshot + plain text to Supabase after edits settle
    if (!isViewer) {
      c.doc.on('update', () => {
        setSaved(false)
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(async () => {
          try {
            await workspaceApi.saveFile(id, f.id, c.snapshotB64(), c.ytext.toString())
            setSaved(true)
            if (historyOpenRef.current) loadChanges()
          } catch { /* retry on next edit */ }
        }, 1500)
      })
    }
  }

  const addFile = async () => {
    const name = prompt('File name (e.g. main.py)')
    if (!name) return
    const ext = name.split('.').pop()
    const language = { py: 'python', js: 'javascript', ts: 'typescript', java: 'java', cpp: 'cpp', c: 'cpp', go: 'go' }[ext] || 'python'
    try {
      const { data } = await workspaceApi.createFile(id, name, language)
      setWs((w) => ({ ...w, files: [...w.files, data] }))
      openFile(data)
    } catch { toast.error('Create failed') }
  }

  const importRepo = async () => {
    const repo_url = prompt('Git repo URL (https://github.com/user/repo)')
    if (!repo_url) return
    const branch = prompt('Branch (blank = default)') || ''
    const t = toast.loading('Pulling repo…')
    try {
      const { data } = await workspaceApi.importRepo(id, repo_url.trim(), branch.trim())
      setWs((w) => ({ ...w, files: [...w.files, ...data.files] }))
      toast.success(`Imported ${data.imported} files${data.truncated ? ' (truncated)' : ''}`, { id: t })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Import failed', { id: t })
    }
  }

  const removeFile = async (f, e) => {
    e.stopPropagation()
    if (!confirm(`Delete ${f.name}?`)) return
    try {
      await workspaceApi.deleteFile(id, f.id)
      setWs((w) => ({ ...w, files: w.files.filter((x) => x.id !== f.id) }))
      if (activeFile?.id === f.id) { teardown(); setActiveFile(null) }
    } catch { toast.error('Delete failed') }
  }

  const invite = async (e) => {
    e.preventDefault()
    if (!invEmail.trim()) return
    try {
      const { data } = await workspaceApi.invite(id, invEmail.trim())
      toast.success(data.status === 'added' ? 'Member added' : 'Invite sent')
      setInvEmail(''); loadWs()
    } catch (err) { toast.error(err.response?.data?.detail || 'Invite failed') }
  }

  const copyLink = () => {
    const link = `${window.location.origin}/join/${ws.share_code}`
    navigator.clipboard.writeText(link)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  if (!ws) return <div className="max-w-6xl mx-auto px-6 py-10 text-sm text-ink-400">Loading…</div>

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link to="/workspaces" className="text-ink-400 hover:text-ink-900"><ArrowLeft size={18} /></Link>
          <h1 className="text-lg font-bold text-ink-900">{ws.name}</h1>
          <span className={`text-xs flex items-center gap-1 ${connected ? 'text-lime-500' : 'text-ink-300'}`}>
            {connected ? <Wifi size={13} /> : <WifiOff size={13} />}{connected ? 'Live' : 'Offline'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Presence avatars — other members use their cursor color; current user is neutral */}
          <div className="flex -space-x-2">
            {peers.map((p, i) => {
              const isSelf = p.id === user.id
              return (
                <div key={i} title={isSelf ? `${p.name} (you)` : p.name}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white border-2 border-white"
                  style={{ background: isSelf ? '#9ca3af' : (p.color || colorFor(p.id)) }}>
                  {p.name?.[0]?.toUpperCase()}
                </div>
              )
            })}
          </div>
          <button onClick={toggleHistory}
            className={`flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded border ${showHistory ? 'border-blue-400 text-blue-500' : 'border-ink-200 text-ink-500 hover:text-ink-900'}`}>
            <History size={14} /> History
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[200px_1fr] gap-4">
        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <div className="card p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">Files</span>
              {!isViewer && (
                <div className="flex items-center gap-1.5">
                  <button onClick={importRepo} title="Import git repo" className="text-ink-400 hover:text-ink-900"><GitBranch size={14} /></button>
                  <button onClick={addFile} title="New file" className="text-ink-400 hover:text-ink-900"><Plus size={15} /></button>
                </div>
              )}
            </div>
            {ws.files.length === 0 && <p className="text-xs text-ink-300">No files yet</p>}
            {ws.files.map((f) => (
              <div key={f.id} onClick={() => openFile(f)}
                className={`group flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-sm ${activeFile?.id === f.id ? 'bg-ink-100 text-ink-900' : 'text-ink-500 hover:bg-ink-50'}`}>
                <span className="flex items-center gap-1.5 truncate"><File size={13} /> {f.name}</span>
                {!isViewer && <button onClick={(e) => removeFile(f, e)} className="opacity-0 group-hover:opacity-100 text-ink-300 hover:text-red-500"><Trash2 size={12} /></button>}
              </div>
            ))}
          </div>

          {/* Members */}
          <div className="card p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-2 flex items-center gap-1"><Users size={13} /> Members</div>
            {ws.members?.map((m) => (
              <div key={m.id} className="flex items-center gap-2 py-1 text-sm text-ink-600">
                <div className="w-5 h-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ background: m.id === user.id ? '#9ca3af' : colorFor(m.id) }}>{m.name?.[0]?.toUpperCase()}</div>
                <span className="truncate">{m.name}{m.id === user.id ? ' (you)' : ''}</span>
                <span className="text-[10px] text-ink-300 ml-auto">{m.role}</span>
              </div>
            ))}
            {ws.role === 'owner' && (
              <>
                <form onSubmit={invite} className="mt-2 flex flex-col gap-1.5">
                  <input className="input text-xs" placeholder="Invite by email" value={invEmail} onChange={(e) => setInvEmail(e.target.value)} />
                  <button className="btn-secondary text-xs py-1">Invite</button>
                </form>
                {ws.share_code && ws.share_enabled && (
                  <button onClick={copyLink} className="mt-2 w-full text-xs flex items-center justify-center gap-1 text-ink-500 hover:text-ink-900 border border-ink-200 rounded py-1">
                    {copied ? <><Check size={12} /> Copied</> : <><Link2 size={12} /> Copy invite link</>}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Editor */}
        <div className="card overflow-hidden">
          {activeFile && collab ? (
            <>
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-ink-100 text-xs text-ink-400">
                <span>{activeFile.name}</span>
                <span>{isViewer ? 'read-only' : saved ? 'saved' : 'saving…'}</span>
              </div>
              <CollabEditor collab={collab} language={activeFile.language} readOnly={isViewer} height="72vh" />
            </>
          ) : (
            <div className="h-[72vh] flex items-center justify-center text-sm text-ink-300">
              Select or create a file to start collaborating
            </div>
          )}
        </div>
      </div>

      {/* Change log */}
      {showHistory && (
        <div className="fixed inset-y-0 right-0 w-80 bg-white dark:bg-gray-900 border-l border-ink-200 shadow-xl z-50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100">
            <span className="text-sm font-semibold text-ink-900 flex items-center gap-2"><History size={14} /> Change history</span>
            <button onClick={() => setShowHistory(false)} className="text-ink-400 hover:text-ink-900"><X size={16} /></button>
          </div>
          <div className="flex-1 overflow-auto">
            {changes.length === 0 ? (
              <p className="text-xs text-ink-300 p-4">No changes recorded yet.</p>
            ) : changes.map((c) => (
              <div key={c.id} className="px-4 py-2.5 border-b border-ink-50 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center" style={{ background: colorFor(c.user_id) }}>{c.user_name?.[0]?.toUpperCase()}</div>
                  <span className="font-semibold text-ink-800">{c.user_name}</span>
                  <span className="text-ink-300 ml-auto">{new Date(c.created_at).toLocaleTimeString()}</span>
                </div>
                <div className="text-ink-500 mt-1 ml-6">
                  <span className="font-mono text-ink-400">{c.file_name}</span> · {c.summary}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
