import { useState } from 'react'
import { useHaToken } from '../store/haTokenStore'
import { useAppStore } from '../store/index'

export function HaUnlockModal() {
  const { status, unlockRequested, error, unlock, clear, setError } = useHaToken()
  const { accent } = useAppStore()
  const [passphrase, setPassphrase] = useState('')
  const [loading, setLoading] = useState(false)
  const [showRepair, setShowRepair] = useState(false)
  const [repairLoading, setRepairLoading] = useState(false)

  if (status !== 'locked' || !unlockRequested) return null

  const handleUnlock = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await unlock(passphrase)
      setPassphrase('')
    } catch {
      // error already set in store
    } finally {
      setLoading(false)
    }
  }

  const handleRepair = async () => {
    setRepairLoading(true)
    try {
      await clear()
      setShowRepair(false)
    } finally {
      setRepairLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end' }}>
      <div style={{
        width: '100%', background: 'var(--bg-card)',
        borderRadius: '20px 20px 0 0', border: '1px solid var(--border)', borderBottom: 'none',
        padding: '24px 20px', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 20px' }} />

        {showRepair ? (
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', marginBottom: 4 }}>
              Re-pair with Home Assistant
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', marginBottom: 20, lineHeight: 1.5 }}>
              This will delete your encrypted token from the server. You'll need to re-enter your HA token in Settings.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setShowRepair(false)} style={secondaryBtn}>Cancel</button>
              <button
                type="button"
                onClick={handleRepair}
                disabled={repairLoading}
                style={{ ...primaryBtn('#ef4444'), flex: 2, opacity: repairLoading ? 0.5 : 1 }}
              >
                {repairLoading ? 'Clearing…' : 'Re-pair'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleUnlock}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', marginBottom: 4 }}>
              Unlock Home Assistant
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', marginBottom: 20, lineHeight: 1.5 }}>
              Enter your passphrase to decrypt your HA token.
            </div>
            <input
              type="password"
              value={passphrase}
              onChange={e => { setError(null); setPassphrase(e.target.value) }}
              placeholder="Passphrase"
              autoFocus
              style={inputStyle}
            />
            {error && (
              <div style={{ fontSize: 12, color: '#ef4444', fontFamily: 'var(--font-body)', marginTop: 8 }}>{error}</div>
            )}
            <button
              type="submit"
              disabled={loading || !passphrase}
              style={{ ...primaryBtn(accent), marginTop: 14, opacity: loading || !passphrase ? 0.5 : 1 }}
            >
              {loading ? 'Unlocking…' : 'Unlock'}
            </button>
            <button
              type="button"
              onClick={() => { setError(null); setShowRepair(true) }}
              style={{ display: 'block', marginTop: 14, width: '100%', textAlign: 'center', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}
            >
              Forgot passphrase? Re-pair with HA
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%', background: 'var(--bg-secondary)',
  border: '1px solid var(--border)', borderRadius: 8,
  padding: '10px 12px', color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none',
  boxSizing: 'border-box',
}

const primaryBtn = (bg) => ({
  width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
  background: bg, color: '#fff',
  fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600,
  cursor: 'pointer',
})

const secondaryBtn = {
  flex: 1, padding: '10px 0', borderRadius: 8,
  border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500,
  cursor: 'pointer',
}
