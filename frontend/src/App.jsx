import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Upload, Activity, Brain,
  TrendingUp, AlertCircle, Wifi, Download,
} from 'lucide-react'
import LogUploader from './components/LogUploader'
import InsightFeed from './components/InsightFeed'
import ChatBot from './components/ChatBot'
import ToastContainer, { toast } from './components/Toast'
import { FailurePieChart, ConfidenceBarChart, TrendLineChart, CATEGORY_CONFIG } from './Charts'
import { checkHealth } from './api'

/* ─── Sidebar nav ─────────────────────────────────────────────── */
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',    icon: LayoutDashboard },
  { id: 'analyze',   label: 'Analyze Logs', icon: Upload },
  { id: 'insights',  label: 'Insight Feed', icon: Brain },
  { id: 'trends',    label: 'Trends',       icon: Activity },
]

/* ─── Pipeline steps ──────────────────────────────────────────── */
const PIPELINE = [
  { key: 'ingest',   label: '📂 Ingest' },
  { key: 'classify', label: '🔍 Classify' },
  { key: 'suggest',  label: '💡 Suggest' },
  { key: 'insight',  label: '🧠 Insight' },
  { key: 'done',     label: '✅ Done' },
]

let healthToastShown = false

/* ─── Risk score helper ───────────────────────────────────────── */
function getRisk(result) {
  if (result.failure_category === 'bank_issue' && result.confidence === 'high') return 'high'
  if (result.failure_category === 'insufficient_funds') return 'high'
  if (result.failure_category === 'network_issue') return 'low'
  if (result.confidence === 'low') return 'medium'
  if (result.failure_category === 'unknown') return 'medium'
  return 'medium'
}

/* ─── Export helper ───────────────────────────────────────────── */
function exportResults(results) {
  const data = JSON.stringify(results, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `payment-analysis-${new Date().toISOString().slice(0,10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  toast('Analysis exported as JSON ✅', 'success')
}

/* ─── Stat Card ───────────────────────────────────────────────── */
function StatCard({ label, value, delta, icon: Icon, accentColor, animate }) {
  return (
    <div className="stat-card" style={{ '--card-accent': accentColor }}>
      <div className="label">{label}</div>
      <div className={`value ${animate ? 'count-up' : ''}`} style={{ color: accentColor }}>
        {value}
      </div>
      {delta && <div className="delta">{delta}</div>}
      <div className="icon-bg">{Icon && <Icon size={52} />}</div>
    </div>
  )
}

/* ─── Pipeline Bar ────────────────────────────────────────────── */
function PipelineBar({ stage }) {
  const stages = ['ingest', 'classify', 'suggest', 'insight', 'done']
  const idx = stages.indexOf(stage)
  return (
    <div className="pipeline-bar">
      {PIPELINE.map((step, i) => {
        const status = i < idx ? 'done' : i === idx ? 'active' : ''
        return (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center' }}>
            <div className={`pipeline-step ${status}`}>{step.label}</div>
            {i < PIPELINE.length - 1 && <span className="pipeline-arrow">›</span>}
          </div>
        )
      })}
    </div>
  )
}

/* ─── Main App ────────────────────────────────────────────────── */
export default function App() {
  const [activeTab, setActiveTab]     = useState('dashboard')
  const [results, setResults]         = useState(null)
  const [loading, setLoading]         = useState(false)
  const [backendOk, setBackendOk]     = useState(null)
  const [pipelineStage, setPipeline]  = useState('ingest')
  const [animStats, setAnimStats]     = useState(false)

  // Health check on mount
  useEffect(() => {
    checkHealth()
      .then(ok => {
        setBackendOk(ok)
        if (!healthToastShown) {
          if (!ok) toast('Backend is offline. Start uvicorn in the backend/ folder.', 'warning', 6000)
          else toast('Backend connected ✅', 'success', 3000)
          healthToastShown = true
        }
      })
      .catch(() => setBackendOk(false))
  }, [])

  function handleLoading(isLoading) {
    setLoading(isLoading)
    if (isLoading) {
      setPipeline('ingest')
      const stages = ['classify', 'suggest', 'insight']
      stages.forEach((s, i) => setTimeout(() => setPipeline(s), (i + 1) * 1800))
    }
  }

  function handleResults(data) {
    setResults(data)
    setPipeline('done')
    setAnimStats(true)
    setTimeout(() => setAnimStats(false), 600)
    setActiveTab('insights')
    const total = data.total_processed
    const cats = data.summary?.categories || {}
    toast(
      `Analysis complete! ${total} transactions processed 🎉`,
      'success',
      5000
    )
    if (cats.insufficient_funds) {
      toast(`⚠️ ${cats.insufficient_funds} insufficient fund failure(s) detected`, 'warning', 5000)
    }
  }

  // Derived stats
  const summary = results?.summary || {}
  const cats    = summary.categories || {}
  const total   = results?.total_processed || 0
  const bankN   = cats.bank_issue || 0
  const netN    = cats.network_issue || 0
  const fundsN  = cats.insufficient_funds || 0
  const highConf= summary.confidence_levels?.high || 0

  // Risk breakdown
  const riskCounts = results?.results?.reduce((acc, r) => {
    const risk = getRisk(r)
    acc[risk] = (acc[risk] || 0) + 1
    return acc
  }, {}) || {}

  return (
    <>
      <ToastContainer />
      <ChatBot />

      <div className="app-shell">
        {/* ── Sidebar ────────────────────────────────────────── */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="brand-logo-frame">
              <img className="brand-logo" src="/logo.png" alt="Sentipay Smart Payment Analyzer logo" />
            </div>
            <div className="brand-copy">
              <h1>Sentipay</h1>
              <span>Smart Payment Analyzer</span>
            </div>
          </div>

          <nav className="sidebar-nav">
            <div className="nav-label">Navigation</div>
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                id={`nav-${id}`}
                className={`nav-item ${activeTab === id ? 'active' : ''}`}
                onClick={() => setActiveTab(id)}
              >
                <Icon size={16} />
                {label}
                {id === 'insights' && total > 0 && (
                  <span className="badge">{total}</span>
                )}
              </button>
            ))}

            {/* Risk summary in sidebar */}
            {results && (
              <>
                <div className="nav-label" style={{ marginTop: 12 }}>Risk Summary</div>
                {Object.entries(riskCounts).map(([risk, count]) => (
                  <div key={risk} className="nav-item" style={{ cursor: 'default', justifyContent: 'space-between' }}>
                    <span className={`risk-badge risk-${risk}`}>{risk}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{count}</span>
                  </div>
                ))}
              </>
            )}

            <div className="nav-label" style={{ marginTop: 12 }}>System</div>
            <div className="nav-item" style={{ cursor: 'default' }}>
              <Wifi size={16} style={{ color: backendOk === false ? 'var(--danger)' : backendOk ? 'var(--success)' : 'var(--warning)' }} />
              Backend
              <span style={{
                marginLeft: 'auto', fontSize: '0.65rem', fontWeight: 600,
                color: backendOk === false ? 'var(--danger)' : backendOk ? 'var(--success)' : 'var(--warning)',
              }}>
                {backendOk === null ? 'checking…' : backendOk ? 'online' : 'offline'}
              </span>
            </div>
          </nav>
        </aside>

        {/* ── Main ───────────────────────────────────────────── */}
        <main className="main-content">
          {/* Topbar */}
          <header className="topbar">
            <div className="topbar-heading">
              <img className="topbar-brand-mark" src="/logo-mark.png" alt="" aria-hidden="true" />
              <div>
                <div className="topbar-title">
                  {activeTab === 'dashboard' && '📊 Dashboard Overview'}
                  {activeTab === 'analyze'   && '🔍 Analyze Transaction Logs'}
                  {activeTab === 'insights'  && '🧠 AI Insight Feed'}
                  {activeTab === 'trends'    && '📈 Failure Trends'}
                </div>
                <div className="topbar-sub">
                  Sentipay · Groq LLaMA 3.3 70B ·{' '}
                  {results ? `${total} transactions analyzed` : 'No data yet — upload logs to begin'}
                </div>
              </div>
            </div>
            <div className="topbar-actions">
              {results && (
                <button
                  id="export-btn"
                  className="btn btn-export"
                  onClick={() => exportResults(results)}
                  title="Export analysis as JSON"
                >
                  <Download size={14} /> Export
                </button>
              )}
              <div className="status-pill">
                <div className="status-dot" />
                AI Engine Ready
              </div>
            </div>
          </header>

          <div className="page-body">

            {/* ── DASHBOARD ─────────────────────────────────── */}
            {activeTab === 'dashboard' && (
              <>
                {/* Pipeline status */}
                {(loading || results) && <PipelineBar stage={loading ? pipelineStage : 'done'} />}

                {/* Stats */}
                <div className="stats-grid">
                  <StatCard label="Total Analyzed"    value={total || '—'} delta={total ? 'transactions' : 'upload logs to begin'} icon={Activity}    accentColor="var(--accent)"   animate={animStats} />
                  <StatCard label="Bank Issues"        value={bankN || '—'}  delta={total ? `${Math.round(bankN/total*100)||0}% of total` : ''}           icon={AlertCircle} accentColor="var(--bank)"     animate={animStats} />
                  <StatCard label="Network Issues"     value={netN  || '—'}  delta={total ? `${Math.round(netN/total*100)||0}% of total` : ''}            icon={Wifi}        accentColor="var(--network)"  animate={animStats} />
                  <StatCard label="Insufficient Funds" value={fundsN|| '—'}  delta={total ? `${Math.round(fundsN/total*100)||0}% of total` : ''}          icon={TrendingUp}  accentColor="var(--funds)"    animate={animStats} />
                </div>

                {/* Charts */}
                {results ? (
                  <>
                    <div className="charts-row">
                      <div className="card">
                        <div className="card-header">
                          <div>
                            <div className="card-title">📊 Failure Distribution</div>
                            <div className="card-sub">By category</div>
                          </div>
                        </div>
                        <FailurePieChart data={cats} />
                      </div>
                      <div className="card">
                        <div className="card-header">
                          <div>
                            <div className="card-title">📈 Cumulative Trend</div>
                            <div className="card-sub">Failure accumulation across batch</div>
                          </div>
                        </div>
                        <TrendLineChart results={results.results} />
                        <div style={{ marginTop: 16 }}>
                          <div className="card-title" style={{ marginBottom: 8 }}>🎯 Confidence Breakdown</div>
                          <ConfidenceBarChart data={summary.confidence_levels || {}} />
                        </div>
                      </div>
                    </div>

                    {/* Risk overview */}
                    <div className="card hero-glow">
                      <div className="card-header">
                        <div className="card-title">⚠️ Risk Overview</div>
                        <button id="export-dashboard-btn" className="btn btn-export" onClick={() => exportResults(results)}>
                          <Download size={13} /> Export JSON
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        {['high','medium','low'].map(risk => (
                          <div key={risk} style={{ flex: 1, minWidth: 120, background: 'var(--bg-secondary)', borderRadius: 10, padding: '16px 20px', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
                            <div className={`risk-badge risk-${risk}`} style={{ marginBottom: 8, display: 'inline-flex' }}>
                              {risk === 'high' ? '🔴' : risk === 'medium' ? '🟡' : '🟢'} {risk} risk
                            </div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: risk === 'high' ? 'var(--bank)' : risk === 'medium' ? 'var(--warning)' : 'var(--success)' }}>
                              {riskCounts[risk] || 0}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>transactions</div>
                          </div>
                        ))}
                        <div style={{ flex: 2, minWidth: 200, background: 'var(--bg-secondary)', borderRadius: 10, padding: '16px 20px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Classifier</div>
                          <div style={{ fontSize: '0.85rem', marginBottom: 4 }}>
                            🤖 LLM: <strong style={{ color: 'var(--accent)' }}>{results.results.filter(r => r.classifier_used === 'llm').length}</strong>
                          </div>
                          <div style={{ fontSize: '0.85rem' }}>
                            📋 Rules: <strong style={{ color: 'var(--success)' }}>{results.results.filter(r => r.classifier_used === 'rule_based').length}</strong>
                          </div>
                          <div style={{ marginTop: 10, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            High confidence: <strong style={{ color: 'var(--success)' }}>{highConf}</strong> / {total}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="card hero-glow">
                    <div className="empty-state">
                      <div className="icon">🚀</div>
                      <h3>Ready to analyze</h3>
                      <p>Go to <strong>Analyze Logs</strong>, upload your transaction logs, and hit Analyze Failures.</p>
                      <p style={{ marginTop: 6, fontSize: '0.75rem' }}>
                        💬 Ask <strong>PayBot</strong> (bottom right) for help anytime!
                      </p>
                      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setActiveTab('analyze')} id="go-to-analyze-btn">
                        <Upload size={15} /> Start Analyzing
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── ANALYZE ───────────────────────────────────── */}
            {activeTab === 'analyze' && (
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">📂 Upload Transaction Logs</div>
                    <div className="card-sub">JSON arrays · drag-and-drop · paste directly · max 100 transactions</div>
                  </div>
                </div>
                {loading && <PipelineBar stage={pipelineStage} />}
                {backendOk === false && (
                  <div className="error-alert" style={{ marginBottom: 16 }}>
                    ⚠️ Backend offline — run <code style={{ fontFamily: 'var(--font-mono)', margin: '0 4px' }}>python -m uvicorn main:app --reload</code> in the <code>backend/</code> folder.
                  </div>
                )}
                <LogUploader onResults={handleResults} onLoading={handleLoading} />
              </div>
            )}

            {/* ── INSIGHTS ──────────────────────────────────── */}
            {activeTab === 'insights' && (
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">🧠 AI-Generated Insights</div>
                    <div className="card-sub">
                      {results ? `${total} transactions · human-readable summaries + retry suggestions` : 'Analyze logs first'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {results && (
                      <button className="btn btn-export" onClick={() => exportResults(results)} id="export-insights-btn">
                        <Download size={13} /> Export
                      </button>
                    )}
                    {results && (
                      <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px' }} onClick={() => setActiveTab('analyze')} id="re-analyze-btn">
                        + New Batch
                      </button>
                    )}
                  </div>
                </div>
                <InsightFeed results={results?.results || []} loading={loading} />
              </div>
            )}

            {/* ── TRENDS ────────────────────────────────────── */}
            {activeTab === 'trends' && (
              <>
                {results ? (
                  <>
                    <div className="card">
                      <div className="card-header">
                        <div className="card-title">📈 Cumulative Failure Trend</div>
                      </div>
                      <TrendLineChart results={results.results} />
                    </div>
                    <div className="charts-row">
                      <div className="card">
                        <div className="card-header"><div className="card-title">🍩 Category Split</div></div>
                        <FailurePieChart data={cats} />
                      </div>
                      <div className="card">
                        <div className="card-header"><div className="card-title">🎯 Classifier Confidence</div></div>
                        <ConfidenceBarChart data={summary.confidence_levels || {}} />
                        <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                          <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>Classifier Used</strong>
                          {results.results.filter(r => r.classifier_used === 'llm').length} × 🤖 LLM &nbsp;·&nbsp;
                          {results.results.filter(r => r.classifier_used === 'rule_based').length} × 📋 Rule-based
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="card">
                    <div className="empty-state">
                      <div className="icon">📈</div>
                      <h3>No trend data</h3>
                      <p>Analyze a batch of logs first to see trends.</p>
                      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setActiveTab('analyze')} id="go-analyze-trends-btn">
                        <Upload size={15} /> Analyze Logs
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </>
  )
}
