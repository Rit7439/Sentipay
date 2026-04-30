import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from 'recharts'

/* ─── Category helpers ───────────────────────────────────────────── */
export const CATEGORY_CONFIG = {
  bank_issue:          { label: 'Bank Issue',          color: '#ff6b6b', emoji: '🏦', badgeClass: 'badge-bank'    },
  network_issue:       { label: 'Network Issue',       color: '#00e5ff', emoji: '📡', badgeClass: 'badge-network' },
  insufficient_funds:  { label: 'Insufficient Funds',  color: '#d8b75f', emoji: '💳', badgeClass: 'badge-funds'   },
  unknown:             { label: 'Unknown',              color: '#667892', emoji: '❓', badgeClass: 'badge-unknown' },
}

const CONF_COLORS = { high: '#00e676', medium: '#f6c95f', low: '#ff6b6b' }

/* ─── Failure Distribution Pie ───────────────────────────────────── */
export function FailurePieChart({ data }) {
  // data: { categories: { bank_issue: N, ... } }
  const chartData = Object.entries(data).map(([key, value]) => ({
    name: CATEGORY_CONFIG[key]?.label || key,
    value,
    color: CATEGORY_CONFIG[key]?.color || '#667892',
  }))

  const total = chartData.reduce((s, d) => s + d.value, 0)

  return (
    <div style={{ position: 'relative' }}>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%" cy="50%"
            innerRadius={60} outerRadius={90}
            paddingAngle={3}
            dataKey="value"
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [value, name]}
            contentStyle={{ background: '#0c1f34', border: '1px solid rgba(216,183,95,0.35)', borderRadius: '8px', fontSize: '12px' }}
            itemStyle={{ color: '#e8edf5' }}
          />
          <Legend iconType="circle" iconSize={8} />
        </PieChart>
      </ResponsiveContainer>
      {/* Centre label */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center', pointerEvents: 'none',
      }}>
        <div style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1 }}>{total}</div>
        <div style={{ fontSize: '0.65rem', color: '#4d6080', textTransform: 'uppercase', letterSpacing: '0.05em' }}>total</div>
      </div>
    </div>
  )
}

/* ─── Confidence Breakdown Bar ───────────────────────────────────── */
export function ConfidenceBarChart({ data }) {
  // data: { high: N, medium: N, low: N }
  const chartData = Object.entries(data).map(([key, value]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    count: value,
    color: CONF_COLORS[key] || '#667892',
  }))

  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(216,183,95,0.1)" />
        <XAxis dataKey="name" tick={{ fill: '#4d6080', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#4d6080', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: '#0c1f34', border: '1px solid rgba(216,183,95,0.35)', borderRadius: '8px', fontSize: '12px' }}
          itemStyle={{ color: '#e8edf5' }}
          cursor={{ fill: 'rgba(216,183,95,0.06)' }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ─── Trend Line (simulated over batch) ─────────────────────────── */
export function TrendLineChart({ results }) {
  // Simulate time trend: group by category index
  const data = results.map((r, i) => ({
    idx: i + 1,
    bank_issue:         r.failure_category === 'bank_issue' ? 1 : 0,
    network_issue:      r.failure_category === 'network_issue' ? 1 : 0,
    insufficient_funds: r.failure_category === 'insufficient_funds' ? 1 : 0,
  }))

  // Cumulative
  const cumulative = data.reduce((acc, d, i) => {
    const prev = i > 0 ? acc[i - 1] : { bank_issue: 0, network_issue: 0, insufficient_funds: 0 }
    acc.push({
      idx: d.idx,
      bank_issue:         prev.bank_issue + d.bank_issue,
      network_issue:      prev.network_issue + d.network_issue,
      insufficient_funds: prev.insufficient_funds + d.insufficient_funds,
    })
    return acc
  }, [])

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={cumulative} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(216,183,95,0.1)" />
        <XAxis dataKey="idx" tick={{ fill: '#4d6080', fontSize: 11 }} axisLine={false} tickLine={false} label={{ value: 'Transaction #', position: 'insideBottom', offset: -2, fill: '#4d6080', fontSize: 10 }} />
        <YAxis tick={{ fill: '#4d6080', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: '#0c1f34', border: '1px solid rgba(216,183,95,0.35)', borderRadius: '8px', fontSize: '12px' }}
          itemStyle={{ color: '#e8edf5' }}
        />
        <Legend iconType="circle" iconSize={8} />
        <Line type="monotone" dataKey="bank_issue"         name="Bank"    stroke="#ff6b6b" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="network_issue"      name="Network" stroke="#00e5ff" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="insufficient_funds" name="Funds"   stroke="#d8b75f" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
