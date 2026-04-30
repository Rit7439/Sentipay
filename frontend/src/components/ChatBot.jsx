import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Bot, User, ChevronDown, Sparkles } from 'lucide-react'
import { sendChatMessage } from '../api'

const QUICK_QUESTIONS = [
  '💳 Why do payments fail?',
  '🔄 When should I retry?',
  '📂 How do I upload logs?',
  '🤖 What does the AI do?',
  '🏦 What is a bank issue?',
  '📡 What is a network issue?',
]

const WELCOME = {
  role: 'assistant',
  content: "Hi! I'm **PayBot** 🤖 — your AI guide for the Smart Payment Failure Analyzer.\n\nAsk me anything about payment failures, retry strategies, or how to use this tool!",
}

function renderMarkdown(text) {
  // Simple inline markdown: **bold**, newlines
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>')
}

export default function ChatBot() {
  const [open, setOpen]         = useState(false)
  const [messages, setMessages] = useState([WELCOME])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [pulse, setPulse]       = useState(true)
  const bottomRef               = useRef(null)
  const inputRef                = useRef(null)

  // Stop pulsing after 8s
  useEffect(() => {
    const t = setTimeout(() => setPulse(false), 8000)
    return () => clearTimeout(t)
  }, [])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200)
  }, [open])

  async function send(text) {
    const userMsg = text || input.trim()
    if (!userMsg || loading) return
    setInput('')

    const newMessages = [...messages, { role: 'user', content: userMsg }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const data = await sendChatMessage(
        newMessages.map(m => ({ role: m.role, content: m.content }))
      )
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I couldn't connect to the backend. Make sure it's running! 🔌",
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      {/* ── Floating Button ─────────────────────────────── */}
      <button
        id="paybot-toggle"
        className="paybot-fab"
        onClick={() => { setOpen(v => !v); setPulse(false) }}
        aria-label="Open PayBot"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
        {pulse && !open && <span className="paybot-pulse" />}
        {!open && <span className="paybot-fab-label">PayBot</span>}
      </button>

      {/* ── Chat Panel ──────────────────────────────────── */}
      <div className={`paybot-panel ${open ? 'paybot-open' : ''}`} id="paybot-panel">

        {/* Header */}
        <div className="paybot-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="paybot-avatar">
              <Bot size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>PayBot</div>
              <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Sparkles size={10} /> Groq LLaMA 3.3 · AI Guide
              </div>
            </div>
          </div>
          <button className="paybot-close" onClick={() => setOpen(false)} aria-label="Close">
            <ChevronDown size={18} />
          </button>
        </div>

        {/* Messages */}
        <div className="paybot-messages" id="paybot-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`paybot-msg ${msg.role}`}>
              <div className="paybot-msg-icon">
                {msg.role === 'assistant' ? <Bot size={13} /> : <User size={13} />}
              </div>
              <div
                className="paybot-bubble"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
              />
            </div>
          ))}

          {loading && (
            <div className="paybot-msg assistant">
              <div className="paybot-msg-icon"><Bot size={13} /></div>
              <div className="paybot-bubble paybot-typing">
                <span /><span /><span />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick Questions */}
        {messages.length <= 1 && (
          <div className="paybot-quick">
            {QUICK_QUESTIONS.map((q, i) => (
              <button
                key={i}
                className="paybot-quick-btn"
                id={`quick-q-${i}`}
                onClick={() => send(q)}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="paybot-input-row">
          <textarea
            ref={inputRef}
            id="paybot-input"
            className="paybot-input"
            placeholder="Ask me anything about payments…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
          />
          <button
            id="paybot-send"
            className="paybot-send-btn"
            onClick={() => send()}
            disabled={!input.trim() || loading}
            aria-label="Send"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </>
  )
}
