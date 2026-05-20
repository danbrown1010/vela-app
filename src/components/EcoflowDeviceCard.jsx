import { useEcoFlow } from '../hooks/useEcoFlow'
import { useAppStore } from '../store/index'

/**
 * Compact card for a single EcoFlow device. Replaces the chip+expanded-card
 * pattern. Designed to stack vertically with other devices.
 */
export function EcoflowDeviceCard({ device, onShowInfo }) {
  const { accent } = useAppStore()
  const { data, loading, error, lastUpdated } = useEcoFlow(device.sn)

  const hasBattery = device.capacity > 0
  const soc = data?.soc
  const inW = data?.totalInputWatts ?? 0
  const outW = data?.totalOutputWatts ?? 0
  const netW = inW - outW
  const remainMin = data?.remainTime

  // Status dot color — 3-tier when discharging: green >50%, orange 20–50%, red <20%
  const dotColor = loading
    ? 'var(--text-tertiary)'
    : error
    ? '#ef4444'
    : netW > 0
    ? '#22c55e'                                              // charging
    : netW < 0
    ? soc == null || !hasBattery
      ? '#f59e0b'
      : soc < 20
      ? '#ef4444'                                            // discharging critical
      : soc < 50
      ? '#f59e0b'                                            // discharging low
      : '#22c55e'                                            // discharging healthy
    : 'var(--text-tertiary)'                                 // idle

  const statusLabel = loading
    ? 'Loading…'
    : error
    ? 'Offline'
    : netW > 0
    ? `Charging · +${netW}W`
    : netW < 0
    ? `Discharging · ${netW}W`
    : 'Idle'

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '14px 14px 22px',
      position: 'relative', overflow: 'hidden',
    }}>
      <style>{`@keyframes vela-soc-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.35);opacity:0.55}}`}</style>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 14 }}>
        <div style={{
          width: 11, height: 11, borderRadius: '50%',
          background: dotColor, flexShrink: 0,
          animation: (netW !== 0 && !loading && !error) ? 'vela-soc-pulse 1.6s ease-in-out infinite' : 'none',
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 600,
            color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {device.name}
          </div>
          <div style={{
            fontSize: 11, color: 'var(--text-tertiary)',
            fontFamily: 'var(--font-body)', marginTop: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {statusLabel}
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            fontSize: 12, fontFamily: 'var(--font-mono)',
            color: 'var(--text-secondary)', lineHeight: 1.3,
          }}>
            {device.model}
          </div>
          {remainMin != null && remainMin > 0 && (
            <div style={{
              fontSize: 10, fontFamily: 'var(--font-mono)',
              color: 'var(--text-tertiary)', marginTop: 2,
            }}>
              {formatRemain(remainMin)}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 4 }}>
          {onShowInfo && (
            <button
              onClick={() => onShowInfo({ device, data })}
              aria-label="Info"
              style={iconBtnStyle}
            >i</button>
          )}
        </div>
      </div>

      {/* Center row: watts + large SOC */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ font: '500 15px var(--font-mono)', color: 'var(--text-secondary)', flex: 1 }}>
          ↓ {inW}W in
        </span>
        {hasBattery && soc != null ? (
          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, color: accent, lineHeight: 1, display: 'inline-flex', alignItems: 'baseline' }}>
            <span style={{ fontSize: 34 }}>{soc}</span>
            <span style={{ fontSize: 18, marginLeft: 2 }}>%</span>
          </span>
        ) : null}
        <span style={{ font: '500 15px var(--font-mono)', color: 'var(--text-secondary)', flex: 1, textAlign: 'right' }}>
          ↑ {outW}W out
        </span>
      </div>

      {lastUpdated && (
        <div style={{
          fontSize: 9, fontFamily: 'var(--font-mono)',
          color: 'var(--text-tertiary)',
          opacity: 0.5,
          marginTop: 6, textAlign: 'right',
          letterSpacing: '0.06em',
        }}>
          {relativeTime(lastUpdated)}
        </div>
      )}

      {/* Battery strip — absolute at bottom */}
      {hasBattery && soc != null && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          height: 5, background: 'rgba(255,255,255,0.04)',
        }}>
          <div style={{
            height: '100%', width: `${soc}%`,
            background: dotColor,
            transition: 'width 0.4s, background 0.2s',
          }} />
        </div>
      )}
    </div>
  )
}

const iconBtnStyle = {
  width: 26, height: 26, borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-secondary)',
  fontSize: 11, fontFamily: 'var(--font-mono)',
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

function formatRemain(min) {
  if (min == null) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h > 0) return `${h}h ${m}m left`
  return `${m}m left`
}

function relativeTime(date) {
  if (!date) return ''
  const secs = Math.floor((Date.now() - date.getTime()) / 1000)
  if (secs < 10)  return 'just now'
  if (secs < 60)  return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return `${Math.floor(secs / 3600)}h ago`
}
