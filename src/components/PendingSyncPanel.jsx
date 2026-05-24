import { useState, useEffect, useCallback } from 'react'
import { listPending, getLastSyncTime } from '../utils/pendingSync'
import { usePendingSyncCount } from '../hooks/usePendingSync'

const TYPE_LABELS = {
  gear: 'Gear save',
  'gear-delete': 'Gear delete',
  track: 'Track save',
  'track-delete': 'Track delete',
  trip: 'Trip save',
  'trip-delete': 'Trip delete',
}

export default function PendingSyncPanel({ user, onClose, onRetry, showToast }) {
  const count = usePendingSyncCount()
  const [items, setItems]       = useState([])
  const [lastSync, setLastSync] = useState(null)
  const [retrying, setRetrying] = useState(false)

  const refresh = useCallback(async () => {
    setItems(await listPending())
    setLastSync(getLastSyncTime())
  }, [])

  useEffect(() => {
    refresh()
    const handler = () => refresh()
    window.addEventListener('vela:sync-changed', handler)
    return () => window.removeEventListener('vela:sync-changed', handler)
  }, [refresh])

  const handleRetry = async () => {
    if (retrying || !user) return
    setRetrying(true)
    try {
      const result = await onRetry?.()
      if (!result) return
      const { succeeded, failed, offline, unexpected } = result
      if (offline) {
        showToast?.('Offline — connect to sync')
      } else if (!unexpected) {
        // unexpected=true means onError already fired a toast; avoid doubling up
        if (failed === 0 && succeeded > 0) {
          showToast?.(`Synced ${succeeded} item${succeeded === 1 ? '' : 's'}`)
        } else if (succeeded === 0 && failed > 0) {
          showToast?.(`Sync failed for ${failed} item${failed === 1 ? '' : 's'}`)
        } else if (succeeded > 0 && failed > 0) {
          showToast?.(`Synced ${succeeded}, ${failed} failed`)
        }
        // succeeded === 0 && failed === 0: nothing was pending, no toast
      }
    } finally {
      setRetrying(false)
    }
  }

  const formatLastSync = (date) => {
    if (!date) return 'Never'
    const diff = Date.now() - date.getTime()
    if (diff < 60_000) return 'Just now'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
    return date.toLocaleDateString()
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 160, backdropFilter: 'blur(2px)' }}
      />
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 165,
        background: 'var(--bg-primary)',
        borderRadius: '20px 20px 0 0',
        border: '1px solid var(--border)',
        borderBottom: 'none',
        paddingBottom: 'env(safe-area-inset-bottom)',
        maxHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUpSheet 0.22s ease-out',
      }}>
        {/* handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)' }} />
        </div>

        {/* header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 20px 12px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
              Unsynced Changes
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              Last sync: {formatLastSync(lastSync)}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* item list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {count === 0 ? (
            <div style={{
              padding: '32px 20px', textAlign: 'center',
              fontSize: 14, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)',
            }}>
              All changes are synced.
            </div>
          ) : items.map((item, i) => (
            <div key={`${item.type}-${item.id}-${i}`} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 20px',
              borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--accent)', flexShrink: 0,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 500, color: 'var(--text-primary)',
                  fontFamily: 'var(--font-body)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
                  {TYPE_LABELS[item.type] ?? item.type}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* retry button */}
        {count > 0 && user && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
            <button
              onClick={handleRetry}
              disabled={retrying}
              style={{
                width: '100%',
                padding: '12px 0',
                background: retrying ? 'var(--bg-secondary)' : 'var(--accent)',
                color: retrying ? 'var(--text-secondary)' : '#fff',
                border: 'none',
                borderRadius: 12,
                fontFamily: 'var(--font-body)',
                fontSize: 15,
                fontWeight: 600,
                cursor: retrying ? 'not-allowed' : 'pointer',
              }}
            >
              {retrying ? 'Syncing…' : 'Retry Sync Now'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
