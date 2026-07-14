import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { workspaceApi } from '../services/api'
import toast from 'react-hot-toast'

export default function JoinWorkspace() {
  const { code } = useParams()
  const nav = useNavigate()

  useEffect(() => {
    (async () => {
      try {
        const { data } = await workspaceApi.join(code)
        nav(`/workspace/${data.workspace_id}`, { replace: true })
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Invalid invite link')
        nav('/workspaces', { replace: true })
      }
    })()
  }, [code])

  return <div className="max-w-4xl mx-auto px-6 py-10 text-sm text-ink-400">Joining workspace…</div>
}
