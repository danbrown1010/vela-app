import { useState, useEffect } from 'react'
import { useCommunications } from '../hooks/useCommunications'
import { useAppStore } from '../store/index'
import { useSetRigStatus } from '../store/rigStatus'

const COMMS_FRESHNESS_MS = 25000

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
  const setRigStatus = useSetRigStatus()

  const age = lastUpdated ? Date.now() - lastUpdated.getTime() : Infinity
  const commsStatus =
    !isConfigured ? 'unconfigured'
    : error && error !== 'Home Assistant not configured' ? 'offline'
    : !error && age < COMMS_FRESHNESS_MS ? 'connected'
    : 'offline'

  useEffect(() => {
    setRigStatus('comms', commsStatus)
  }, [commsStatus, setRigStatus])

  const slateAdminUrl = 'http://192.168.8.1'
  const starlinkAppUrl = 'https://www.starlink.com/account/home'

  const cpuSev    = severityFor(cpuTempF,  THRESHOLDS.cpuTempF)
  const memorySev = severityFor(memoryPct, THRESHOLDS.memoryPct)
  const flashSev  = severityFor(flashPct,  THRESHOLDS.flashPct)
  const systemHasWarning  = [cpuSev, memorySev, flashSev].some(s => s !== 'normal')
  const systemHasCritical = [cpuSev, memorySev, flashSev].some(s => s === 'critical')

  const [systemSheetOpen, setSystemSheetOpen] = useState(false)

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
    <>
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
            Chomp Wifi{' '}
            <span style={{
              fontWeight: 400,
              color: wifiOn ? 'var(--text-secondary)' : '#ef4444',
            }}>
              {wifiOn ? 'online' : 'offline'}
            </span>
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
        <button
          onClick={() => setSystemSheetOpen(true)}
          aria-label="System info"
          style={{
            width: 32, height: 32, borderRadius: 8,
            border: `1px solid ${
              systemHasCritical ? '#ef444466' :
              systemHasWarning  ? '#f59e0b66' :
                                   'var(--border)'
            }`,
            background: 'transparent',
            color: systemHasCritical ? '#ef4444' :
                   systemHasWarning  ? '#f59e0b' :
                                        'var(--text-secondary)',
            fontSize: 13, fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
            transition: 'border-color 0.2s, color 0.2s',
          }}
          className="active:opacity-70 transition-opacity"
        >
          i
        </button>
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

      <div style={{
        display: 'flex', alignItems: 'center', gap: 20,
        marginTop: 14,
        fontSize: 11, fontFamily: 'var(--font-mono)',
        letterSpacing: '0.06em',
      }}>
        <a href={slateAdminUrl} target="_blank" rel="noreferrer"
          style={{ color: 'var(--text-tertiary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          className="hover:opacity-80 active:opacity-60 transition-opacity"
        >Slate AX admin ↗</a>
        <a href={starlinkAppUrl} target="_blank" rel="noreferrer"
          style={{ color: 'var(--text-tertiary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          className="hover:opacity-80 active:opacity-60 transition-opacity"
        >Starlink app ↗</a>
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

    {systemSheetOpen && (
      <SystemInfoSheet
        onClose={() => setSystemSheetOpen(false)}
        cpuTempF={cpuTempF}
        memoryPct={memoryPct}
        flashPct={flashPct}
        cpuSev={cpuSev}
        memorySev={memorySev}
        flashSev={flashSev}
        uptimeIso={uptimeIso}
      />
    )}
    </>
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


const footerRefreshStyle = {
  width: 22, height: 22, borderRadius: 5,
  border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text-tertiary)', fontSize: 11,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}

function SystemInfoSheet({ onClose, cpuTempF, memoryPct, flashPct, cpuSev, memorySev, flashSev, uptimeIso }) {
  const rows = [
    { label: 'CPU Temperature', value: cpuTempF  != null ? `${Math.round(cpuTempF)}°F`  : '—', severity: cpuSev,    detail: 'Throttles around 160°F' },
    { label: 'Memory',          value: memoryPct != null ? `${memoryPct.toFixed(0)}%`    : '—', severity: memorySev, detail: 'Slate AX has 512 MB DDR' },
    { label: 'Flash',           value: flashPct  != null ? `${flashPct.toFixed(0)}%`     : '—', severity: flashSev,  detail: 'Long-term wear concern, not urgent' },
  ]

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxHeight: '85vh', overflowY: 'auto',
          background: 'var(--bg-card)',
          borderRadius: '20px 20px 0 0',
          border: '1px solid var(--border)', borderBottom: 'none',
          padding: '24px 20px',
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 20px' }} />

        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', marginBottom: 4 }}>
          System Status
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', marginBottom: 20, lineHeight: 1.5 }}>
          GL.iNet Slate AX (AXT1800)
        </div>

        {rows.map(row => (
          <div key={row.label} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 16px', marginBottom: 8,
            background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: SEVERITY_DOT_COLORS[row.severity], flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>{row.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', marginTop: 2 }}>{row.detail}</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: SEVERITY_COLORS[row.severity], fontFamily: 'var(--font-body)', flexShrink: 0 }}>
              {row.value}
            </div>
          </div>
        ))}

        {uptimeIso && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', marginTop: 12,
            background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>Uptime</div>
            <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{formatUptime(uptimeIso)}</div>
          </div>
        )}
      </div>
    </div>
  )
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
