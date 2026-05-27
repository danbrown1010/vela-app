import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { SEVERITY, ThreatIcon, ActionButtons } from './ThreatHeadline'
import { IconX } from './icons'
import { useAppStore } from '../store/index'

function bearingToCardinal(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(deg / 45) % 8]
}

export function ThreatDetailSheet({ threat, onClose }) {
  const [visible, setVisible] = useState(false)
  const { weatherAlerts } = useAppStore()

  useEffect(() => {
    if (!threat) return
    requestAnimationFrame(() => setVisible(true))
    return () => setVisible(false)
  }, [threat])

  useEffect(() => {
    if (!threat) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [threat, onClose])

  if (!threat) return null

  const sev = SEVERITY[threat.severity] ?? SEVERITY.minor

  const nwsAlert = threat.type === 'weather_alert'
    ? (weatherAlerts ?? []).find(a => a.properties?.id === threat.id)
    : null
  const nwsDesc = nwsAlert?.properties?.description ?? ''
  const nwsInstr = nwsAlert?.properties?.instruction ?? ''

  const descMatch = nwsDesc.match(/DESCRIPTION[:\s]*([\s\S]*?)(?=INSTRUCTIONS?[:\s]|$)/i)
  const instrMatch = nwsDesc.match(/INSTRUCTIONS?[:\s]*([\s\S]*?)$/i)
  const descText = (descMatch?.[1] ?? nwsDesc).trim()
  const instrText = (instrMatch?.[1] ?? nwsInstr).trim()

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 200,
        display: 'flex', alignItems: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          background: 'var(--bg-primary)',
          borderRadius: '20px 20px 0 0',
          maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 200ms ease-out',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
        }}
      >
        {/* Severity header bar */}
        <div style={{
          background: `color-mix(in srgb, ${sev.mix} 18%, transparent)`,
          borderBottom: `1px solid ${sev.border}`,
          borderRadius: '20px 20px 0 0',
          padding: '14px 16px 12px',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 8, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1 }}>
            <span style={{ color: sev.text, marginTop: 2, flexShrink: 0 }}>
              <ThreatIcon type={threat.type} />
            </span>
            <div style={{
              fontSize: 15, fontWeight: 700,
              color: sev.text, fontFamily: 'var(--font-body)',
              lineHeight: 1.3,
            }}>
              {threat.headline}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 28, height: 28, borderRadius: 8,
              border: 'none', background: 'transparent',
              color: 'var(--text-tertiary)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0, flexShrink: 0,
            }}
            className="active:opacity-70"
          >
            <IconX style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{
          overflowY: 'auto', flex: 1,
          padding: '16px 16px 0',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {/* Distance + bearing */}
          {(threat.distanceMi != null || threat.bearing != null) && (
            <div style={{ display: 'flex', gap: 16 }}>
              {threat.distanceMi != null && (
                <MetaChip label="Distance" value={`${threat.distanceMi} mi`} />
              )}
              {threat.bearing != null && (
                <MetaChip label="Direction" value={bearingToCardinal(threat.bearing)} />
              )}
            </div>
          )}

          {/* Trajectory */}
          {threat.trajectory && (
            <MetaChip label="Movement" value={threat.trajectory} />
          )}

          {/* Detail prose */}
          {threat.detail && (
            <p style={{
              margin: 0,
              fontSize: 13, lineHeight: 1.6,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-body)',
            }}>
              {threat.detail}
            </p>
          )}

          {/* NWS description */}
          {descText && (
            <Section label="Details" body={descText} />
          )}

          {/* NWS instructions */}
          {instrText && (
            <Section label="Instructions" body={instrText} />
          )}

          {/* Source */}
          {threat.source && (
            <div style={{
              fontSize: 11, color: 'var(--text-tertiary)',
              fontFamily: 'var(--font-mono)',
            }}>
              Source: {threat.source}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingBottom: 16 }}>
            <ActionButtons type={threat.type} severity={threat.severity} />
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

function MetaChip({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{
        fontSize: 10, fontFamily: 'var(--font-mono)',
        color: 'var(--text-tertiary)', letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 14, fontWeight: 600,
        color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
      }}>
        {value}
      </span>
    </div>
  )
}

function Section({ label, body }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{
        fontSize: 10, fontFamily: 'var(--font-mono)',
        color: 'var(--text-tertiary)', letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}>
        {label}
      </div>
      <p style={{
        margin: 0,
        fontSize: 12, lineHeight: 1.7,
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-body)',
        whiteSpace: 'pre-wrap',
      }}>
        {body}
      </p>
    </div>
  )
}
