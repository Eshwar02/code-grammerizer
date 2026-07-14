import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { IndexeddbPersistence } from 'y-indexeddb'

// Backend WS host. Falls back to deriving ws:// from the REST API URL, then origin.
function wsBase() {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL.replace(/\/$/, '')
  const api = import.meta.env.VITE_API_URL
  if (api) return api.replace(/^http/, 'ws').replace(/\/$/, '')
  return window.location.origin.replace(/^http/, 'ws')
}

const PALETTE = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
export function colorFor(id) {
  return PALETTE[Math.abs(Number(id) || 0) % PALETTE.length]
}

// base64 <-> Uint8Array (Yjs binary snapshots)
export function u8ToB64(u8) {
  let s = ''
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i])
  return btoa(s)
}
export function b64ToU8(b64) {
  const s = atob(b64)
  const u8 = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i)
  return u8
}

/**
 * Wire up a collaborative document for one file.
 * room = "<workspaceId>:<fileId>". `snapshot` = base64 Yjs state from server (optional).
 */
export function createCollab(room, user, snapshot, initialText = '') {
  const doc = new Y.Doc()
  const ytext = doc.getText('monaco')

  // Local-first cache: reload restores instantly from IndexedDB, no network wait.
  const persistence = new IndexeddbPersistence(`ws-${room}`, doc)

  // Seed from the server snapshot once (idempotent CRDT merge, applied only if new).
  if (snapshot) {
    try { Y.applyUpdate(doc, b64ToU8(snapshot)) } catch { /* ignore bad snapshot */ }
  }

  // Seed initial code (e.g. from an existing review) exactly once per document.
  // `seeded` flag in shared state guards against duplicate inserts across clients.
  if (initialText) {
    const meta = doc.getMap('meta')
    const seedOnce = () => {
      if (!meta.get('seeded') && ytext.length === 0) {
        doc.transact(() => { meta.set('seeded', true); ytext.insert(0, initialText) })
      }
    }
    persistence.once('synced', seedOnce)
  }

  const token = localStorage.getItem('token')
  const provider = new WebsocketProvider(`${wsBase()}/ws/collab`, room, doc, {
    params: { token },
  })
  provider.awareness.setLocalStateField('user', {
    id: user.id,
    name: user.name,
    color: colorFor(user.id),
  })

  return {
    doc,
    ytext,
    provider,
    awareness: provider.awareness,
    persistence,
    snapshotB64: () => u8ToB64(Y.encodeStateAsUpdate(doc)),
    destroy() {
      provider.awareness.setLocalState(null)
      provider.destroy()
      persistence.destroy()
      doc.destroy()
    },
  }
}
