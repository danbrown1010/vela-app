const STYLES = {
  safe:     { bg: 'color-mix(in srgb, var(--safe) 15%, transparent)',    border: 'var(--safe)',    color: 'var(--safe)'    },
  advisory: { bg: 'color-mix(in srgb, var(--accent) 12%, transparent)',  border: 'var(--accent)',  color: 'var(--accent)'  },
  warn:     { bg: 'color-mix(in srgb, var(--accent) 20%, transparent)',  border: 'var(--accent)',  color: 'var(--accent)'  },
  danger:   { bg: 'color-mix(in srgb, var(--danger) 15%, transparent)',  border: 'var(--danger)',  color: 'var(--accent)'  },
  monitor:  { bg: 'color-mix(in srgb, var(--safe) 20%, transparent)',    border: 'var(--safe)',    color: 'var(--safe)'    },
  linked:   { bg: 'color-mix(in srgb, var(--safe) 15%, transparent)',    border: 'var(--safe)',    color: 'var(--safe)'    },
  off:      { bg: 'color-mix(in srgb, var(--text-tertiary) 10%, transparent)', border: 'var(--text-tertiary)', color: 'var(--text-tertiary)' },
  soon:     { bg: 'color-mix(in srgb, var(--text-tertiary) 10%, transparent)', border: 'var(--text-tertiary)', color: 'var(--text-tertiary)' },
}

export function StatusBadge({ status, label, dot = true }) {
  const s = STYLES[status] ?? STYLES.monitor
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      background: s.bg,
      border: `1px solid ${s.border}`,
      borderRadius: 20,
      padding: '3px 10px',
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      fontWeight: 700,
      color: s.color,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>
      {dot && (
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
      )}
      {label}
    </div>
  )
}
