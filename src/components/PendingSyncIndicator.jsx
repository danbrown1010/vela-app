import { usePendingSyncCount } from '../hooks/usePendingSync'

export default function PendingSyncIndicator({ onOpen }) {
  const count = usePendingSyncCount()

  if (count === 0) return null

  return (
    <button
      onClick={onOpen}
      aria-label={`${count} unsynced change${count === 1 ? '' : 's'} — tap to review`}
      style={{
        position: 'fixed',
        bottom: 'calc(72px + env(safe-area-inset-bottom))',
        right: 16,
        zIndex: 150,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 12px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 999,
        boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
        cursor: 'pointer',
        fontFamily: 'var(--font-body)',
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--text-primary)',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{
        width: 18, height: 18,
        background: 'var(--accent)',
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: '#fff',
        flexShrink: 0,
      }}>
        {count > 99 ? '99+' : count}
      </span>
      Unsynced
    </button>
  )
}
