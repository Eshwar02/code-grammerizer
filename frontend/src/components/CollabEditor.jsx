import Editor from '@monaco-editor/react'
import { useEffect, useRef, useState } from 'react'
import { MonacoBinding } from 'y-monaco'

const LANG = { cpp: 'cpp', go: 'go', js: 'javascript', ts: 'typescript' }

// Inject one CSS rule per remote client so each user's cursor/selection uses their color.
function syncCursorStyles(awareness) {
  const id = 'yjs-remote-cursor-styles'
  let el = document.getElementById(id)
  if (!el) {
    el = document.createElement('style')
    el.id = id
    document.head.appendChild(el)
  }
  let css = ''
  awareness.getStates().forEach((state, clientId) => {
    const color = state?.user?.color
    const name = (state?.user?.name || 'anon').replace(/'/g, '')
    if (!color) return
    css += `
      .yRemoteSelection-${clientId} { background-color: ${color}44; }
      .yRemoteSelectionHead-${clientId} { position: relative; border-left: ${color} 2px solid; }
      .yRemoteSelectionHead-${clientId}::after {
        content: '${name}';
        position: absolute; top: -1.4em; left: -2px; white-space: nowrap;
        background: ${color}; color: #fff; font-size: 10px; padding: 0 4px; border-radius: 2px;
      }`
  })
  el.textContent = css
}

export default function CollabEditor({ collab, language = 'python', readOnly = false, height = '70vh' }) {
  const editorRef = useRef(null)
  const [ready, setReady] = useState(false)

  // Effect owns the binding lifecycle: (re)bind on file (collab) change or editor mount.
  useEffect(() => {
    if (!collab || !ready || !editorRef.current) return
    const model = editorRef.current.getModel()
    const binding = new MonacoBinding(collab.ytext, model, new Set([editorRef.current]), collab.awareness)

    const onAware = () => syncCursorStyles(collab.awareness)
    onAware()
    collab.awareness.on('change', onAware)

    return () => {
      collab.awareness.off('change', onAware)
      binding.destroy()
    }
  }, [collab, ready])

  return (
    <Editor
      height={height}
      language={LANG[language] || language}
      theme="vs-dark"
      onMount={(editor) => { editorRef.current = editor; setReady(true) }}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 4,
        wordWrap: 'on',
      }}
    />
  )
}
