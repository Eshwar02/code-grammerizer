import Editor from '@monaco-editor/react'
import { useRef, useEffect } from 'react'

export default function CodeEditor({ value, onChange, language = 'python', lintFindings = [], height = '400px' }) {
  const editorRef = useRef(null)
  const monacoRef = useRef(null)

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return
    const model = editorRef.current.getModel()
    if (!model) return
    const markers = lintFindings.map((f) => ({
      severity: f.severity === 'error'
        ? monacoRef.current.MarkerSeverity.Error
        : f.severity === 'warning'
        ? monacoRef.current.MarkerSeverity.Warning
        : monacoRef.current.MarkerSeverity.Info,
      startLineNumber: f.line || 1,
      startColumn: (f.col || 0) + 1,
      endLineNumber: f.line || 1,
      endColumn: 999,
      message: `[${f.symbol}] ${f.message}`,
      source: f.source || 'lint',
    }))
    monacoRef.current.editor.setModelMarkers(model, 'live-lint', markers)
  }, [lintFindings])

  return (
    <Editor
      height={height}
      language={language === 'cpp' ? 'cpp' : language === 'go' ? 'go' : language}
      value={value}
      onChange={onChange}
      onMount={(editor, monaco) => {
        editorRef.current = editor
        monacoRef.current = monaco
      }}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 4,
        wordWrap: 'on',
        renderWhitespace: 'none',
      }}
    />
  )
}
