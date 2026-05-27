import { IconFire, IconCloudRain, IconWind, IconX } from './icons'

// Severity uses deriveThreats vocabulary: extreme / severe / moderate / minor
export const SEVERITY = {
  extreme:  { border: 'var(--status-offline)', mix: 'var(--status-offline)', text: 'var(--status-offline)' },
  severe:   { border: 'var(--warn)',           mix: 'var(--warn)',           text: 'var(--warn)'           },
  moderate: { border: 'var(--status-warning)', mix: 'var(--status-warning)', text: 'var(--status-warning)' },
  minor:    { border: 'var(--status-loading)', mix: 'var(--status-loading)', text: 'var(--status-loading)' },
}

const stub = (action) => () => console.log('TODO:', action)

const Btn = ({ label, action }) => (
  <button
    onClick={stub(action)}
    style={{
      padding: '6px 12px', borderRadius: 8,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--text-secondary)',
      fontSize: 12, fontFamily: 'var(--font-body)',
      cursor: 'pointer',
    }}
    className="active:opacity-70 transition-opacity"
  >
    {label}
  </button>
)

// Type uses deriveThreats vocabulary: wildfire / weather_alert / air_quality / burn_ban
export function ThreatIcon({ type }) {
  const sz = { width: 15, height: 15, flexShrink: 0 }
  if (type === 'wildfire' || type === 'burn_ban') return <IconFire style={sz} />
  if (type === 'air_quality') return <IconWind style={sz} />
  return <IconCloudRain style={sz} />
}

export function ActionButtons({ type, severity }) {
  if (type === 'wildfire') return (
    <>
      <Btn label="View on map"   action="view-on-map"   />
      <Btn label="Escape routes" action="escape-routes" />
    </>
  )
  if (type === 'weather_alert' && (severity === 'severe' || severity === 'extreme')) return (
    <Btn label="Pre-storm checklist" action="pre-storm-checklist" />
  )
  if (type === 'air_quality') return <Btn label="Outdoor advice"   action="outdoor-advice"   />
  if (type === 'burn_ban')    return <Btn label="Burn ban details" action="burn-ban-details" />
  return null
}

export function ThreatHeadline({ threat, onDismiss, onOpenDetail }) {
  const sev = SEVERITY[threat.severity] ?? SEVERITY.minor

  return (
    <div style={{
      background: `color-mix(in srgb, ${sev.mix} 12%, transparent)`,
      border: `1px solid ${sev.border}`,
      borderRadius: 14,
      padding: '12px 14px',
      position: 'relative',
    }}>
      {/* Dismiss */}
      <button
        onClick={onDismiss}
        aria-label="Dismiss alert"
        style={{
          position: 'absolute', top: 10, right: 10,
          width: 24, height: 24, borderRadius: 6,
          border: 'none', background: 'transparent',
          color: 'var(--text-tertiary)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0,
        }}
        className="active:opacity-70"
      >
        <IconX style={{ width: 14, height: 14 }} />
      </button>

      {/* Tappable zone: header + detail */}
      <div
        role="button"
        tabIndex={0}
        onClick={onOpenDetail}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onOpenDetail?.()}
        style={{ cursor: onOpenDetail ? 'pointer' : 'default', marginBottom: 10 }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 8,
          paddingRight: 28,
          marginBottom: threat.detail ? 6 : 0,
        }}>
          <span style={{ color: sev.text, marginTop: 1 }}>
            <ThreatIcon type={threat.type} />
          </span>
          <div style={{
            fontSize: 14, fontWeight: 700,
            color: sev.text, fontFamily: 'var(--font-body)',
            lineHeight: 1.3,
          }}>
            {threat.headline}
          </div>
        </div>

        {/* Detail */}
        {threat.detail && (
          <div style={{
            fontSize: 12, color: 'var(--text-secondary)',
            fontFamily: 'var(--font-body)', lineHeight: 1.5,
            paddingLeft: 23,
          }}>
            {threat.detail}
          </div>
        )}
      </div>

      {/* Action row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingLeft: 23 }}>
        <ActionButtons type={threat.type} severity={threat.severity} />
      </div>
    </div>
  )
}
