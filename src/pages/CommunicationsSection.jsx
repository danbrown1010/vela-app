import { useCommunications } from '../hooks/useCommunications'
import { useAppStore } from '../store/index'

// Slate AX (AXT1800) thresholds
const THRESHOLDS = {
  cpuTempF: { warning: 130, critical: 155 },  // throttles around 160°F
  memoryPct: { warning: 70,  critical: 85 },
  flashPct:  { warning: 80,  critical: 95 },
}

const SEVERITY_COLORS = {
  normal:   'var(--text-primary)',
  warning:  '#f59e0b',
  critical: '#ef4444',
}

const SEVERITY_DOT_COLORS = {
  normal:   '#22c55e',
  warning:  '#f59e0b',
  critical: '#ef4444',
}

function severityFor(value, { warning, critical }) {
  if (!Number.isFinite(value)) return 'normal'
  if (value >= critical) return 'critical'
  if (value >= warning) return 'warning'
  return 'normal'
}

export function CommunicationsSection() {
  const { accent } = useAppStore()
  const {
    loading, error, lastUpdated, isConfigured,
    wifiOn, cpuTempF, memoryPct, flashPct, uptimeIso,
    speedtestDown, speedtestUp, speedtestPing,
    refetch,
  } = useCommunications()

  const slateAdminUrl = 'http://192.168.8.1'
  const starlinkAppUrl = 'https://www.starlink.com/account/home'

  if (!isConfigured) {
    return (
      <Card title="Communications">
        <Empty
          title="Home Assistant not configured"
          body="Connect Home Assistant in Settings to monitor your rig network."
          ctaLabel="Open Settings"
          accent={accent}
          onClick={() => {
            window.dispatchEvent(
              new CustomEvent('vela:open-settings', { detail: { section: 'home_assistant' } })
            )
          }}
        />
      </Card>
    )
  }

  if (loading && !lastUpdated) {
    return (
      <Card title="Communications">
        <Status dot="var(--text-tertiary)" label="Loading…" sub="Polling Home Assistant" />
      </Card>
    )
  }

  if (error && !lastUpdated) {
    return (
      <Card title="Communications">
        <Status dot="#ef4444" label="Home Assistant unreachable" sub={error} onRefresh={refetch} />
      </Card>
    )
  }

  return (
    <Card title="Communications">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: wifiOn ? '#22c55e' : '#ef4444',
          flexShrink: 0,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 600,
            color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
          }}>
            Chomp Wifi {wifiOn ? 'online' : 'offline'}
          </div>
          {uptimeIso && (
            <div style={{
              fontSize: 11, color: 'var(--text-tertiary)',
              fontFamily: 'var(--font-mono)', marginTop: 2,
            }}>
              up {formatUptime(uptimeIso)}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
        <Metric
          label="CPU"
          value={cpuTempF != null ? `${Math.round(cpuTempF)}°F` : '—'}
          severity={severityFor(cpuTempF, THRESHOLDS.cpuTempF)}
        />
        <Metric
          label="Memory"
          value={memoryPct != null ? `${memoryPct.toFixed(0)}%` : '—'}
          severity={severityFor(memoryPct, THRESHOLDS.memoryPct)}
        />
        <Metric
          label="Flash"
          value={flashPct != null ? `${flashPct.toFixed(0)}%` : '—'}
          severity={severityFor(flashPct, THRESHOLDS.flashPct)}
        />
      </div>

      {(speedtestDown != null || speedtestUp != null || speedtestPing != null) && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14,
          paddingTop: 14, borderTop: '1px solid var(--border)',
        }}>
          <Metric
            label="↓ Download"
            value={speedtestDown != null ? `${speedtestDown.toFixed(1)} Mbps` : '—'}
          />
          <Metric
            label="↑ Upload"
            value={speedtestUp != null ? `${speedtestUp.toFixed(1)} Mbps` : '—'}
          />
          <Metric
            label="Ping"
            value={speedtestPing != null ? `${Math.round(speedtestPing)} ms` : '—'}
          />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <LinkButton href={slateAdminUrl} label="Slate AX admin" />
        <LinkButton href={starlinkAppUrl} label="Starlink app" />
      </div>

      {lastUpdated && (
        <div style={{
          paddingTop: 10, borderTop: '1px solid var(--border)',
          fontSize: 10, fontFamily: 'var(--font-mono)',
          color: 'var(--text-tertiary)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
        }}>
          <span>Updated {lastUpdated.toLocaleTimeString()}</span>
          <button onClick={refetch} aria-label="Refresh" style={footerRefreshStyle}>↺</button>
        </div>
      )}
    </Card>
  )
}

// ─── Subcomponents ─────────────────────────────────────────────────────────────

function Card({ title, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
        color: 'var(--text-tertiary)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
      }}>
        {title}
      </div>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 14, padding: 16,
      }}>
        {children}
      </div>
    </div>
  )
}

function Status({ dot, label, sub, onRefresh }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 600,
          color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
        }}>
          {label}
        </div>
        {sub && (
          <div style={{
            fontSize: 12, color: 'var(--text-secondary)',
            fontFamily: 'var(--font-body)', marginTop: 2,
          }}>
            {sub}
          </div>
        )}
      </div>
      {onRefresh && (
        <button onClick={onRefresh} aria-label="Retry" style={footerRefreshStyle}>↺</button>
      )}
    </div>
  )
}

function Empty({ title, body, ctaLabel, accent, onClick }) {
  return (
    <div style={{ textAlign: 'center', padding: '4px 0' }}>
      <div style={{
        fontSize: 14, fontWeight: 600,
        color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
        marginBottom: 4,
      }}>
        {title}
      </div>
      <div style={{
        fontSize: 12, color: 'var(--text-secondary)',
        fontFamily: 'var(--font-body)', marginBottom: 16, lineHeight: 1.5,
      }}>
        {body}
      </div>
      <button
        onClick={onClick}
        style={{
          padding: '9px 20px', borderRadius: 8, border: 'none',
          background: accent, color: '#fff',
          fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
          cursor: 'pointer',
        }}
        className="active:opacity-80 transition-opacity"
      >
        {ctaLabel}
      </button>
    </div>
  )
}

function Metric({ label, value, severity = 'normal' }) {
  const valueColor = SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.normal
  const dotColor   = SEVERITY_DOT_COLORS[severity] ?? SEVERITY_DOT_COLORS.normal

  return (
    <div>
      <div style={{
        fontSize: 10, fontFamily: 'var(--font-mono)',
        color: 'var(--text-tertiary)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
        }} />
        {label}
      </div>
      <div style={{
        fontSize: 18, fontWeight: 600,
        color: valueColor, fontFamily: 'var(--font-body)', marginTop: 2,
        transition: 'color 0.3s',
      }}>
        {value}
      </div>
    </div>
  )
}

function LinkButton({ href, label }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        flex: 1, padding: '9px 12px', borderRadius: 8,
        border: '1px solid var(--border)', background: 'transparent',
        color: 'var(--text-primary)', fontSize: 12,
        fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer',
        textAlign: 'center', textDecoration: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
      }}
      className="active:opacity-70 transition-opacity"
    >
      {label} ↗
    </a>
  )
}

const footerRefreshStyle = {
  width: 22, height: 22, borderRadius: 5,
  border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text-tertiary)', fontSize: 11,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}

function formatUptime(iso) {
  try {
    const then = new Date(iso).getTime()
    const now = Date.now()
    const sec = Math.max(0, Math.floor((now - then) / 1000))
    const days = Math.floor(sec / 86400)
    const hours = Math.floor((sec % 86400) / 3600)
    if (days > 0) return `${days}d ${hours}h`
    const mins = Math.floor((sec % 3600) / 60)
    return `${hours}h ${mins}m`
  } catch { return '' }
}
