export const TRIP_TYPES = [
  'Overlanding', 'Photography', 'Fishing', 'Hunting',
  'Skiing', 'Camping', 'Hiking', 'Festival', 'Day Trip',
]

const ICONS = {
  Overlanding: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="2"/>
      <path d="M16 8h4l3 3v5h-7V8z"/>
      <circle cx="5.5" cy="18.5" r="2.5"/>
      <circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  ),
  Photography: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  ),
  Fishing: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2l-2 2a4 4 0 000 5.66L18 12"/>
      <path d="M18 12c-3 3-6.5 4-10 3 0-3.5 1-7 4-10"/>
      <path d="M8 5C6 7 5 10 6 13c-2.5-.5-4-2-4-4.5C2 5 5 2 8.5 2"/>
    </svg>
  ),
  Skiing: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="17" cy="4" r="2"/>
      <path d="M3 20l4-8 3 3 4-6 4 5"/>
      <path d="M3 20h18"/>
    </svg>
  ),
  Camping: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 20l9-14 9 14H3z"/>
      <path d="M10 20c0-1.1.9-2 2-2s2 .9 2 2"/>
    </svg>
  ),
  Hiking: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 4a1 1 0 100-2 1 1 0 000 2z" fill="currentColor" stroke="none"/>
      <path d="M7 20l2-6 3 3 2-4 4 7"/>
      <path d="M12 11l-1-4 4 1-3 2z" fill="currentColor" stroke="none"/>
      <path d="M12 11l-1-4 4 1"/>
    </svg>
  ),
  Hunting: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8"/>
      <line x1="12" y1="1" x2="12" y2="5"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="1" y1="12" x2="5" y2="12"/>
      <line x1="19" y1="12" x2="23" y2="12"/>
    </svg>
  ),
  Festival: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13"/>
      <circle cx="6" cy="18" r="3"/>
      <circle cx="18" cy="16" r="3"/>
    </svg>
  ),
  'Day Trip': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <line x1="12" y1="2" x2="12" y2="6"/>
      <line x1="12" y1="18" x2="12" y2="22"/>
      <line x1="2" y1="12" x2="6" y2="12"/>
      <line x1="18" y1="12" x2="22" y2="12"/>
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
    </svg>
  ),
}

const COLORS = {
  Overlanding: '#f97316',
  Photography: '#3b82f6',
  Fishing:     '#22c55e',
  Skiing:      '#60a5fa',
  Camping:     '#f59e0b',
  Hiking:      '#84cc16',
  Hunting:    '#92400e',
  Festival:   '#a855f7',
  'Day Trip': '#06b6d4',
}

export function TypeBadge({ type, size = 'sm', showLabel = true }) {
  const color = COLORS[type] ?? 'var(--text-tertiary)'
  const icon  = ICONS[type]
  const isSmall = size === 'sm'

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: showLabel ? (isSmall ? 3 : 5) : 0,
      padding: showLabel
        ? (isSmall ? '2px 7px 2px 5px' : '3px 10px 3px 7px')
        : (isSmall ? '3px 5px' : '4px 7px'),
      borderRadius: 20,
      background: `${color}18`,
      border: `1px solid ${color}40`,
      color,
      fontSize: isSmall ? 10 : 12,
      fontWeight: 600,
      fontFamily: 'var(--font-body)',
      whiteSpace: 'nowrap',
    }}>
      {icon}
      {showLabel && type}
    </span>
  )
}

export function TypeSelector({ selected, onChange }) {
  const toggle = (type) => {
    onChange(
      selected.includes(type)
        ? selected.filter(t => t !== type)
        : [...selected, type]
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {TRIP_TYPES.map(t => {
        const active = selected.includes(t)
        const color  = COLORS[t] ?? '#888'
        return (
          <button
            key={t}
            onClick={() => toggle(t)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 5,
              padding: '10px 6px',
              borderRadius: 12,
              border: active ? `1.5px solid ${color}` : '1.5px solid var(--border)',
              background: active ? `${color}18` : 'var(--bg-secondary)',
              color: active ? color : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {ICONS[t]}
            <span style={{ fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-body)' }}>{t}</span>
          </button>
        )
      })}
    </div>
  )
}
