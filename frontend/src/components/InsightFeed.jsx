import { useState } from 'react'
import { ChevronDown, ChevronUp, Clock, CreditCard, RefreshCw, Copy, Check } from 'lucide-react'
import { CATEGORY_CONFIG } from '../Charts'

function getRisk(result) {
  if (result.failure_category === 'bank_issue' && result.confidence === 'high') return 'high'
  if (result.failure_category === 'insufficient_funds') return 'high'
  if (result.failure_category === 'network_issue') return 'low'
  if (result.confidence === 'low') return 'medium'
  return 'medium'
}

function CategoryIcon({ category }) {
  const cfg = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.unknown
  const bgMap = {
    bank_issue:         'var(--bank-dim)',
    network_issue:      'var(--network-dim)',
    insufficient_funds: 'var(--funds-dim)',
    unknown:            'var(--unknown-dim)',
  }
  return (
    <div className="insight-icon" style={{ background: bgMap[category] || bgMap.unknown }}>
      {cfg.emoji}
    </div>
  )
}

function ConfidenceDot({ level }) {
  const color = level === 'high' ? 'var(--success)' : level === 'medium' ? 'var(--warning)' : 'var(--danger)'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {level}
    </span>
  )
}

function InsightCard({ result, index }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied]     = useState(false)
  const cfg  = CATEGORY_CONFIG[result.failure_category] || CATEGORY_CONFIG.unknown
  const risk = getRisk(result)

  function copyInsight() {
    navigator.clipboard.writeText(result.human_insight)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="insight-card" id={`insight-${result.transaction_id}`}>
      <CategoryIcon category={result.failure_category} />

      <div className="insight-body">
        <div className="insight-tid">
          #{index + 1} · {result.transaction_id}
          <span style={{ marginLeft: 8 }}>
            <span className={`badge ${cfg.badgeClass}`}>{cfg.label}</span>
          </span>
          <span style={{ marginLeft: 6 }}>
            <ConfidenceDot level={result.confidence} />
          </span>
          <span className={`risk-badge risk-${risk}`} style={{ marginLeft: 6 }}>
            {risk === 'high' ? '🔴' : risk === 'medium' ? '🟡' : '🟢'} {risk}
          </span>
          <span style={{ marginLeft: 6, fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            via {result.classifier_used === 'llm' ? '🤖 LLM' : '📋 Rules'}
          </span>
        </div>

        {/* Human insight — the "wow" feature */}
        <div className="insight-human">💡 {result.human_insight}</div>

        {/* Technical detail */}
        <div className="insight-tech" title={result.technical_detail}>
          {result.technical_detail}
        </div>

        {/* Expandable suggestion */}
        {expanded && (
          <div className="suggestion-box" style={{ marginTop: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <strong><Clock size={10} style={{ marginRight: 4 }} />Retry Timing</strong>
                {result.suggestion.retry_timing} · {result.suggestion.retry_attempts} attempt{result.suggestion.retry_attempts !== 1 ? 's' : ''}
              </div>
              <div>
                <strong><CreditCard size={10} style={{ marginRight: 4 }} />Alternate Methods</strong>
                {result.suggestion.alternate_methods.join(' · ')}
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <strong><RefreshCw size={10} style={{ marginRight: 4 }} />Recommended Action</strong>
                {result.suggestion.action}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="insight-meta">
        <button
          id={`copy-btn-${result.transaction_id}`}
          className="btn btn-secondary"
          style={{ padding: '5px 10px', fontSize: '0.72rem' }}
          onClick={copyInsight}
          title="Copy insight to clipboard"
        >
          {copied ? <Check size={13} style={{ color: 'var(--success)' }} /> : <Copy size={13} />}
        </button>
        <button
          id={`expand-btn-${result.transaction_id}`}
          className="btn btn-secondary"
          style={{ padding: '5px 10px', fontSize: '0.72rem' }}
          onClick={() => setExpanded(v => !v)}
          aria-label="Toggle suggestion details"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Less' : 'Details'}
        </button>
      </div>
    </div>
  )
}

export default function InsightFeed({ results, loading }) {
  const [filter, setFilter] = useState('all')

  const categories = ['all', 'bank_issue', 'network_issue', 'insufficient_funds', 'unknown']

  const filtered = filter === 'all'
    ? results
    : results.filter(r => r.failure_category === filter)

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="insight-card" style={{ opacity: 0.6 }}>
            <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 8 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="skeleton" style={{ height: 14, width: '30%' }} />
              <div className="skeleton" style={{ height: 40, width: '100%' }} />
              <div className="skeleton" style={{ height: 28, width: '80%' }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!results.length) {
    return (
      <div className="empty-state">
        <div className="icon">📋</div>
        <h3>No results yet</h3>
        <p>Upload or paste your transaction logs above and click Analyze Failures</p>
      </div>
    )
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="tabs" id="insight-filter-tabs">
        {categories.map(cat => {
          const cfg = CATEGORY_CONFIG[cat]
          const count = cat === 'all' ? results.length : results.filter(r => r.failure_category === cat).length
          return (
            <button
              key={cat}
              className={`tab ${filter === cat ? 'active' : ''}`}
              id={`filter-tab-${cat}`}
              onClick={() => setFilter(cat)}
            >
              {cfg ? `${cfg.emoji} ${cfg.label}` : 'All'} ({count})
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((result, i) => (
          <InsightCard key={result.transaction_id} result={result} index={results.indexOf(result)} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          <div className="icon">🔍</div>
          <h3>No {filter.replace('_', ' ')} failures</h3>
          <p>Good news — none in this batch!</p>
        </div>
      )}
    </div>
  )
}
