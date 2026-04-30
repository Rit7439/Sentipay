import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react'

const ICONS = {
  success: <CheckCircle size={16} />,
  error:   <XCircle size={16} />,
  info:    <Info size={16} />,
  warning: <AlertTriangle size={16} />,
}

const COLORS = {
  success: { bg: 'rgba(72,187,120,0.12)', border: 'rgba(72,187,120,0.3)',  color: '#48bb78' },
  error:   { bg: 'rgba(252,129,129,0.12)', border: 'rgba(252,129,129,0.3)', color: '#fc8181' },
  info:    { bg: 'rgba(79,142,247,0.12)',  border: 'rgba(79,142,247,0.3)',  color: '#4f8ef7' },
  warning: { bg: 'rgba(236,201,75,0.12)', border: 'rgba(236,201,75,0.3)',  color: '#ecc94b' },
}

let _toastFn = null
export function toast(message, type = 'info', duration = 4000) {
  _toastFn?.({ message, type, duration, id: Date.now() })
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    _toastFn = (t) => {
      setToasts(prev => [...prev, t])
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), t.duration)
    }
    return () => { _toastFn = null }
  }, [])

  return (
    <div className="toast-container" id="toast-container">
      {toasts.map(t => {
        const c = COLORS[t.type] || COLORS.info
        return (
          <div
            key={t.id}
            className="toast"
            style={{ background: c.bg, borderColor: c.border }}
          >
            <span style={{ color: c.color }}>{ICONS[t.type]}</span>
            <span style={{ fontSize: '0.82rem', flex: 1 }}>{t.message}</span>
            <button
              className="toast-close"
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
            >
              <X size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
