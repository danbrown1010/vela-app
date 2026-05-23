import { useState } from 'react'
import { useHaToken } from '../store/haTokenStore'
import { useAppStore } from '../store/index'

// Handles both first-time setup (prefilledToken=null, shows token input) and
// localStorage migration (prefilledToken=existing token string, hides token input).
export function HaTokenSetupModal({ prefilledToken, onClose }) {
  const { setToken } = useHaToken()
  const { accent } = useAppStore()
  const [selectedMode, setSelectedMode] = useState('passphrase')
  const [tokenInput, setTokenInput] = useState(prefilledToken ?? '')
  const [passphrase, setPassphrase] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState(null)

  const isMigration = prefilledToken != null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError(null)
    if (!tokenInput.trim()) { setLocalError('Please enter your HA token.'); return }
    if (selectedMode === 'passphrase') {
      if (!passphrase) { setLocalError('Please set a passphrase.'); return }
      if (passphrase !== confirmPass) { setLocalError('Passphrases do not match.'); return }
    }
    setSaving(true)
    try {
      await setToken(tokenInput.trim(), {
        mode: selectedMode,
        passphrase: selectedMode === 'passphrase' ? passphrase : undefined,
      })
      if (isMigration) localStorage.removeItem('vela-ha-token')
      onClose()
    } catch (err) {
      setLocalError(err.message || 'Failed to save token.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end' }}>
      <div style={{
        width: '100%', maxHeight: '92vh', overflowY: 'auto',
        background: 'var(--bg-card)',
        borderRadius: '20px 20px 0 0',
        border: '1px solid var(--border)', borderBottom: 'none',
        padding: '24px 20px',
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 20px' }} />

        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', marginBottom: 12 }}>
          Protect your Home Assistant token
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', marginBottom: 20, lineHeight: 1.6 }}>
          Your HA token controls your home — lights, locks, cameras. We store it encrypted in the cloud so it survives device wipes. You choose who holds the key.
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!isMigration && (
            <input
              value={tokenInput}
              onChange={e => { setLocalError(null); setTokenInput(e.target.value) }}
              placeholder="Long-lived access token"
              type="password"
              style={inputStyle}
            />
          )}

          <ModeOption
            selected={selectedMode === 'passphrase'}
            onSelect={() => { setSelectedMode('passphrase'); setLocalError(null) }}
            label="Use a passphrase (recommended)"
            body={
              <span>
                Only you can decrypt your token. Not even Vela can read it. You'll enter it once per session.{' '}
                <span style={{ color: '#f59e0b' }}>⚠</span>{' '}
                Can't be recovered if forgotten — you'd re-pair with HA to reset.
              </span>
            }
            accent={accent}
          />

          {selectedMode === 'passphrase' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: -4 }}>
              <input
                type="password"
                value={passphrase}
                onChange={e => { setLocalError(null); setPassphrase(e.target.value) }}
                placeholder="Passphrase"
                style={inputStyle}
              />
              <input
                type="password"
                value={confirmPass}
                onChange={e => { setLocalError(null); setConfirmPass(e.target.value) }}
                placeholder="Confirm passphrase"
                style={inputStyle}
              />
            </div>
          )}

          <ModeOption
            selected={selectedMode === 'auto'}
            onSelect={() => { setSelectedMode('auto'); setLocalError(null) }}
            label="Skip passphrase"
            body="Convenient — no extra step. Token is still encrypted, but Vela holds the key. Choose this if you're comfortable with Vela being able to read your HA token."
            accent={accent}
          />

          {localError && (
            <div style={{ fontSize: 12, color: '#ef4444', fontFamily: 'var(--font-body)' }}>{localError}</div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 14, fontFamily: 'var(--font-body)', cursor: 'pointer' }}
            >
              {isMigration ? 'Later' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{ flex: 2, padding: '10px 0', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Saving…' : 'Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModeOption({ selected, onSelect, label, body, accent }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left',
        padding: 14, borderRadius: 12, width: '100%',
        border: `1.5px solid ${selected ? accent : 'var(--border)'}`,
        background: selected ? `color-mix(in srgb, ${accent} 8%, var(--bg-secondary))` : 'var(--bg-secondary)',
        cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 2,
        border: `2px solid ${selected ? accent : 'var(--border)'}`,
        background: selected ? accent : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'border-color 0.15s, background 0.15s',
      }}>
        {selected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', lineHeight: 1.5 }}>
          {body}
        </div>
      </div>
    </button>
  )
}

const inputStyle = {
  width: '100%', background: 'var(--bg-secondary)',
  border: '1px solid var(--border)', borderRadius: 8,
  padding: '10px 12px', color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none',
  boxSizing: 'border-box',
}
