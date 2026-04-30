/* API client — proxied through Vite dev server → FastAPI */

const BASE = '/api'

export async function fetchSampleLogs() {
  const res = await fetch(`${BASE}/sample-logs`)
  if (!res.ok) throw new Error(`Failed to fetch sample logs: ${res.status}`)
  return res.json()
}

export async function analyzeLogs(logs, useLlm = true) {
  const res = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ logs, use_llm: useLlm }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function checkHealth() {
  const res = await fetch(`${BASE}/health`)
  return res.ok
}

export async function sendChatMessage(messages) {
  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })
  if (!res.ok) throw new Error(`Chat error: ${res.status}`)
  return res.json()
}
