import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

/**
 * App-wide, promise-based dialogs that match the site UI (replaces window.confirm/prompt).
 *
 *   const dialog = useDialog()
 *   if (await dialog.confirm({ title, message, danger: true })) { ... }
 *   const name = await dialog.prompt({ title, label, defaultValue })   // string | null
 */
const DialogContext = createContext(null)

export function useDialog() {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useDialog must be used within <DialogProvider>')
  return ctx
}

export function DialogProvider({ children }) {
  const [state, setState] = useState(null)   // { kind, opts, resolve }
  const inputRef = useRef(null)
  const [value, setValue] = useState('')

  const close = useCallback((result) => {
    setState((s) => { s?.resolve(result); return null })
  }, [])

  const confirm = useCallback((opts = {}) =>
    new Promise((resolve) => setState({ kind: 'confirm', opts, resolve })), [])

  const prompt = useCallback((opts = {}) =>
    new Promise((resolve) => { setValue(opts.defaultValue || ''); setState({ kind: 'prompt', opts, resolve }) }), [])

  // focus input on open; Esc to cancel
  useEffect(() => {
    if (!state) return
    if (state.kind === 'prompt') setTimeout(() => inputRef.current?.focus(), 30)
    const onKey = (e) => { if (e.key === 'Escape') close(state.kind === 'prompt' ? null : false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state, close])

  const o = state?.opts || {}
  const isPrompt = state?.kind === 'prompt'
  const cancelResult = isPrompt ? null : false
  const confirmResult = isPrompt ? undefined : true

  const submit = () => close(isPrompt ? value : true)

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4"
          onMouseDown={() => close(cancelResult)}>
          <div className="w-full max-w-sm bg-white dark:bg-gray-900 border border-ink-200 dark:border-gray-700 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-ink-100 dark:border-gray-700 flex items-center gap-2">
              {o.danger && <AlertTriangle size={16} className="text-red-500 shrink-0" />}
              <h3 className="text-sm font-bold text-ink-900 dark:text-white">{o.title || (isPrompt ? 'Enter a value' : 'Are you sure?')}</h3>
            </div>

            <div className="px-5 py-4">
              {o.message && <p className="text-sm text-ink-600 dark:text-gray-400">{o.message}</p>}
              {isPrompt && (
                <>
                  {o.label && <label className="text-xs font-semibold text-ink-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">{o.label}</label>}
                  <input ref={inputRef} className="input" value={value} placeholder={o.placeholder || ''}
                    autoComplete="off"
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') submit() }} />
                </>
              )}
            </div>

            <div className="px-5 py-3 border-t border-ink-100 dark:border-gray-700 flex justify-end gap-2">
              <button onClick={() => close(cancelResult)} className="btn-ghost text-sm">{o.cancelText || 'Cancel'}</button>
              <button onClick={submit}
                className={`text-sm px-4 py-2 font-medium text-white ${o.danger ? 'bg-red-500 hover:bg-red-600' : 'btn-primary'}`}
                disabled={isPrompt && o.required && !value.trim()}>
                {o.confirmText || (o.danger ? 'Delete' : 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  )
}
