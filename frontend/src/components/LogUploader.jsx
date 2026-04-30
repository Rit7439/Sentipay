import { useState, useRef } from 'react'
import { Upload, Wand2, RefreshCw, FileJson, Zap } from 'lucide-react'
import { fetchSampleLogs, analyzeLogs } from '../api'

const PLACEHOLDER = `[
  {
    "transaction_id": "TXN-001",
    "amount": 249.99,
    "currency": "USD",
    "error_code": "insufficient_funds",
    "error_message": "Customer account balance too low",
    "payment_method": "card",
    "bank_name": "Chase Bank",
    "merchant": "TechStore Pro"
  }
]`

export default function LogUploader({ onResults, onLoading }) {
  const [json, setJson]           = useState('')
  const [useLlm, setUseLlm]       = useState(true)
  const [error, setError]         = useState('')
  const [dragging, setDragging]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const fileRef = useRef()

  /* ── Load sample logs from backend ─────────────────── */
  async function loadSamples() {
    setError('')
    setLoading(true)
    onLoading(true)
    try {
      const data = await fetchSampleLogs()
      setJson(JSON.stringify(data.logs, null, 2))
    } catch (e) {
      setError(`Could not fetch samples: ${e.message}. Make sure the backend is running.`)
    } finally {
      setLoading(false)
      onLoading(false)
    }
  }

  /* ── File drop ──────────────────────────────────────── */
  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setJson(ev.target.result)
    reader.readAsText(file)
  }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setJson(ev.target.result)
    reader.readAsText(file)
  }

  /* ── Submit ─────────────────────────────────────────── */
  async function handleAnalyze() {
    setError('')
    let logs
    try {
      logs = JSON.parse(json)
      if (!Array.isArray(logs)) logs = [logs]
    } catch {
      setError('Invalid JSON — please check your input and try again.')
      return
    }

    setLoading(true)
    onLoading(true)
    try {
      const result = await analyzeLogs(logs, useLlm)
      onResults(result)
    } catch (e) {
      setError(`Analysis failed: ${e.message}`)
    } finally {
      setLoading(false)
      onLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Drop zone */}
      <div
        id="log-upload-zone"
        className={`uploader-zone ${dragging ? 'drag-over' : ''}`}
        onClick={() => fileRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <div className="upload-icon"><Upload size={36} /></div>
        <h3>Drop your log file here</h3>
        <p>JSON or CSV · or click to browse · max 100 transactions</p>
        <input ref={fileRef} type="file" accept=".json,.csv" style={{ display: 'none' }} onChange={handleFile} />
      </div>

      {/* OR paste JSON */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileJson size={14} /> Paste JSON logs
          </span>
          <button
            id="load-samples-btn"
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.75rem' }}
            onClick={loadSamples}
            disabled={loading}
          >
            <RefreshCw size={12} /> Load sample logs
          </button>
        </div>
        <textarea
          id="json-editor"
          className="json-editor"
          placeholder={PLACEHOLDER}
          value={json}
          onChange={(e) => setJson(e.target.value)}
        />
      </div>

      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div className="toggle-row">
          <div
            id="llm-toggle"
            className={`toggle ${useLlm ? 'on' : ''}`}
            onClick={() => setUseLlm(v => !v)}
            role="switch"
            aria-checked={useLlm}
          >
            <div className="toggle-knob" />
          </div>
          <Wand2 size={14} style={{ color: 'var(--accent)' }} />
          <span>
            <strong style={{ color: 'var(--text-primary)' }}>LLM Classification</strong>
            <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>
              {useLlm ? '(Groq LLaMA 3.3 · enabled)' : '(rule-based only)'}
            </span>
          </span>
        </div>

        <button
          id="analyze-btn"
          className="btn btn-primary"
          onClick={handleAnalyze}
          disabled={loading || !json.trim()}
        >
          {loading
            ? <><span className="spinner" /> Analyzing…</>
            : <><Zap size={15} /> Analyze Failures</>
          }
        </button>
      </div>

      {error && (
        <div className="error-alert">
          ⚠️ {error}
        </div>
      )}
    </div>
  )
}
