import { useAppStore } from '../store/index'
import { IconPaw } from './icons'

function TabIcon({ id, color }) {
  const stroke = {
    fill: 'none', stroke: color, strokeWidth: 1.75,
    strokeLinecap: 'round', strokeLinejoin: 'round',
  }
  switch (id) {
    case 'home':
      return (
        <div style={{
          width: 24, height: 24, flexShrink: 0,
          background: color,
          WebkitMaskImage: 'url(/vela-mark.png)',
          WebkitMaskSize: 'cover',
          WebkitMaskMode: 'luminance',
          maskImage: 'url(/vela-mark.png)',
          maskSize: 'cover',
          maskMode: 'luminance',
        }} />
      )
    case 'trip':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
          <circle cx="6" cy="19" r="3"/>
          <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/>
          <circle cx="18" cy="5" r="3"/>
        </svg>
      )
    case 'rig':
      return (
        <svg width="26" height="26" viewBox="0 0 24 24" {...stroke}>
          <circle cx="3" cy="12" r="2.8"/>
          <circle cx="21" cy="12" r="2.8"/>
          <line x1="7.6" y1="7" x2="7.6" y2="17"/>
          <line x1="9.8" y1="7" x2="9.8" y2="17"/>
          <line x1="12" y1="7" x2="12" y2="17"/>
          <line x1="14.2" y1="7" x2="14.2" y2="17"/>
          <line x1="16.4" y1="7" x2="16.4" y2="17"/>
        </svg>
      )
    case 'safety':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      )
    case 'pets':
      return <IconPaw size={22} color={color} />
    case 'more':
      return (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round">
          <circle cx="5" cy="12" r="1.5"/>
          <circle cx="12" cy="12" r="1.5"/>
          <circle cx="19" cy="12" r="1.5"/>
        </svg>
      )
    default: return null
  }
}

export default function BottomNav({ active, onChange }) {
  const { accent, pendingInviteCount, petsEnabled } = useAppStore()

  const tabs = [
    { id: 'home',   label: 'Home'   },
    { id: 'trip',   label: 'Trip'   },
    { id: 'rig',    label: 'Rig'    },
    { id: 'safety', label: 'Safety' },
    ...(petsEnabled ? [{ id: 'pets', label: 'Pets' }] : []),
    { id: 'more',   label: 'More'   },
  ]

  return (
    <nav style={{
      display: 'flex', background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border)',
      flexShrink: 0,
      paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
    }}>
      {tabs.map(({ id, label }) => {
        const isActive = active === id
        const color = isActive ? accent : 'var(--text-tertiary)'
        return (
          <button
            key={id}
            onClick={() => { if (navigator.vibrate) navigator.vibrate(10); onChange(id) }}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'flex-end',
              gap: 4, padding: '8px 0', minHeight: 56,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color, fontFamily: 'var(--font-body)',
              transition: 'color 0.15s',
            }}
          >
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <TabIcon id={id} color={color} />
              {id === 'more' && pendingInviteCount > 0 && (
                <span style={{
                  position: 'absolute', top: -3, right: -7,
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'var(--accent)', color: '#fff',
                  font: '700 10px var(--font-mono)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid var(--bg-secondary)',
                }}>{pendingInviteCount}</span>
              )}
            </div>
            <span style={{ font: '600 10px var(--font-body)', letterSpacing: '0.02em' }}>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
