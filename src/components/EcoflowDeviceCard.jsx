import { useEcoFlow } from '../hooks/useEcoFlow'
import { useAppStore } from '../store/index'
import { IconRefresh } from './icons'

/**
 * Compact card for a single EcoFlow device. Replaces the chip+expanded-card
 * pattern. Designed to stack vertically with other devices.
 */
export function EcoflowDeviceCard({ device, onShowInfo }) {
  const { accent } = useAppStore()
  const { data, loading, error, lastUpdated, refetch } = useEcoFlow(device.sn)

  const hasBattery = device.capacity > 0
  const soc = data?.soc
  const inW = data?.totalInputWatts ?? 0
  const outW = data?.totalOutputWatts ?? 0
  const netW = inW - outW
  const remainMin = data?.remainTime

  // Status dot color
  const dotColor = loading
    ? 'var(--text-tertiary)'
    : error
    ? '#ef4444'
    : netW > 0
    ? '#22c55e'                                              // charging
    : netW < 0
    ? hasBattery && soc != null && soc < 20
      ? '#ef4444'                                            // discharging low
      : '#f59e0b'                                            // discharging
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
      borderRadius: 14, padding: 14,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: hasBattery ? 10 : 8 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: dotColor, flexShrink: 0,
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

        {hasBattery && soc != null && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{
              fontSize: 18, fontWeight: 700, color: accent,
              fontFamily: 'var(--font-body)', lineHeight: 1,
            }}>
              {soc}%
            </div>
            {remainMin != null && remainMin > 0 && (
              <div style={{
                fontSize: 10, fontFamily: 'var(--font-mono)',
                color: 'var(--text-tertiary)', marginTop: 3,
              }}>
                {formatRemain(remainMin)}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: hasBattery ? 4 : 0 }}>
          {onShowInfo && (
            <button
              onClick={() => onShowInfo({ device, data })}
              aria-label="Info"
              style={iconBtnStyle}
            >i</button>
          )}
          <button
            onClick={refetch}
            aria-label="Refresh"
            style={iconBtnStyle}
          >
            <IconRefresh style={{ width: 12, height: 12, color: 'var(--text-secondary)' }} />
          </button>
        </div>
      </div>

      {/* Battery bar */}
      {hasBattery && soc != null && (
        <div style={{
          height: 6, borderRadius: 3, background: 'var(--bg-secondary)',
          overflow: 'hidden', marginBottom: 10,
        }}>
          <div style={{
            height: '100%', width: `${soc}%`,
            background: soc > 50 ? '#22c55e' : soc > 20 ? '#f59e0b' : '#ef4444',
            transition: 'width 0.4s',
          }} />
        </div>
      )}

      {/* Watts row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 11, fontFamily: 'var(--font-mono)',
        color: 'var(--text-secondary)',
      }}>
        <span>↓ {inW}W in</span>
        <span style={{ color: 'var(--text-tertiary)' }}>
          {device.model}
        </span>
        <span>↑ {outW}W out</span>
      </div>

      {lastUpdated && (
        <div style={{
          fontSize: 10, fontFamily: 'var(--font-mono)',
          color: 'var(--text-tertiary)', marginTop: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
        }}>
          <span>Updated {lastUpdated.toLocaleTimeString()}</span>
          <button onClick={refetch} aria-label="Refresh" style={{
            width: 22, height: 22, borderRadius: 5,
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-tertiary)', fontSize: 11,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>↺</button>
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
