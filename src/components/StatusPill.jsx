export function StatusPill({ status, label, isActive, onClick, accent }) {
  const dotColor =
    status === 'connected' ? 'var(--status-connected)'
    : status === 'offline' ? 'var(--status-offline)'
    : status === 'loading' ? 'var(--status-loading)'
    : 'var(--status-unconfigured)'

  const dotStyle = {
    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
    transition: 'background 0.2s',
    background: dotColor,
    ...(status === 'loading' && { animation: 'pulse 1.5s ease-in-out infinite' }),
  }

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 14px', borderRadius: 20, flexShrink: 0,
        border: `1px solid ${isActive ? `${accent}99` : 'var(--border)'}`,
        background: isActive ? `${accent}22` : 'transparent',
        color: isActive ? accent : 'var(--text-secondary)',
        fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
        cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s, color 0.15s',
      }}
    >
      <div style={dotStyle} />
      {label}
    </button>
  )
}
