import { Sparkline } from './Sparkline'
import { TimeAxis }  from './TimeAxis'

const TONE_COLORS = {
  connected: 'var(--status-connected)',
  warning:   'var(--status-warning)',
  critical:  'var(--status-offline)',
  neutral:   'var(--text-primary)',
}

export function MetricCard({
  label, sublabel,
  value, unit,
  status, statusTone = 'neutral',
  history,
  minRange = null, maxRange = null,
}) {
  const color        = TONE_COLORS[statusTone] ?? TONE_COLORS.neutral
  const valueDisplay = value == null ? '—' : value

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '18px 20px',
      marginBottom: 12,
    }}>
      {/* Top row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: color, flexShrink: 0,
              display: 'inline-block',
            }} />
            <span style={{
              color,
              fontSize: 28,
              fontWeight: 500,
              fontFamily: 'var(--font-mono)',
              lineHeight: 1,
            }}>
              {valueDisplay}
              {unit && (
                <span style={{ fontSize: 18, marginLeft: unit.startsWith('°') ? 0 : 4 }}>
                  {unit}
                </span>
              )}
            </span>
          </div>
          <div style={{
            color: 'var(--text-tertiary)',
            fontSize: 13,
            fontFamily: 'var(--font-mono)',
            marginTop: 4,
            marginLeft: 18,
          }}>
            {label}{sublabel ? ` · ${sublabel}` : ''}
          </div>
        </div>

        {status && (
          <div style={{
            color,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.12em',
            textAlign: 'right',
            whiteSpace: 'nowrap',
            paddingTop: 6,
          }}>
            {status}
          </div>
        )}
      </div>

      <Sparkline
        samples={history?.samples}
        color={color}
        minValue={minRange ?? undefined}
        maxValue={maxRange ?? undefined}
        ariaLabel={`${label} history`}
      />
      <TimeAxis
        oldestT={history?.oldestT}
        newestT={history?.newestT}
      />
    </div>
  )
}
