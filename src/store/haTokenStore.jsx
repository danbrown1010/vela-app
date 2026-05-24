import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'
import { encryptToken, decryptToken } from '../lib/crypto'

const HaTokenContext = createContext(null)

export function HaTokenProvider({ children, userId }) {
  const [cipherEnvelope, setCipherEnvelope] = useState(null)
  const [mode, setMode] = useState(null)             // 'passphrase' | 'auto' | null
  const [plaintextToken, setPlaintextToken] = useState(null)
  // 'loading' | 'unconfigured' | 'locked' | 'unlocked' | 'error'
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [unlockRequested, setUnlockRequested] = useState(false)
  const [haUrl, setHaUrlState] = useState(null)

  const loadFromDb = useCallback(async () => {
    if (!userId) { setStatus('unconfigured'); return }
    try {
      const { data, error: dbErr } = await supabase
        .from('user_secrets')
        .select('ha_token_encrypted, ha_url')
        .eq('user_id', userId)
        .maybeSingle()
      if (dbErr) throw dbErr

      // Handle ha_url — set from DB, or one-time migrate from localStorage
      if (data?.ha_url) {
        setHaUrlState(data.ha_url)
      } else if (data !== null) {
        // Row exists but ha_url not yet persisted — migrate from localStorage once
        try {
          const localUrl = localStorage.getItem('vela-ha-url')
          if (localUrl) {
            await supabase
              .from('user_secrets')
              .upsert(
                { user_id: userId, ha_url: localUrl, updated_at: new Date().toISOString() },
                { onConflict: 'user_id' },
              )
            setHaUrlState(localUrl)
            localStorage.removeItem('vela-ha-url')
          }
        } catch (migErr) {
          console.warn('[haTokenStore] ha_url localStorage migration failed:', migErr)
        }
      }

      if (data?.ha_token_encrypted) {
        const envelope = data.ha_token_encrypted
        setCipherEnvelope(envelope)
        const envelopeMode = (JSON.parse(envelope).mode) ?? 'passphrase'
        setMode(envelopeMode)

        if (envelopeMode === 'auto') {
          try {
            const plaintext = await decryptToken(envelope, { userId })
            setPlaintextToken(plaintext)
            setStatus('unlocked')
          } catch (decErr) {
            console.error('[haTokenStore] auto-decrypt failed:', decErr)
            setStatus('error')
            setError('Auto-decrypt failed.')
          }
        } else {
          setStatus('locked')
        }
      } else {
        setStatus('unconfigured')
      }
    } catch (err) {
      console.error('[haTokenStore] loadFromDb:', err)
      setStatus('error')
      setError(err.message)
    }
  }, [userId])

  useEffect(() => { loadFromDb() }, [loadFromDb])

  const unlock = useCallback(async (passphrase) => {
    if (!cipherEnvelope) return
    try {
      const plaintext = await decryptToken(cipherEnvelope, { passphrase })
      setPlaintextToken(plaintext)
      setStatus('unlocked')
      setUnlockRequested(false)
      setError(null)
    } catch {
      setError('Incorrect passphrase.')
      throw new Error('Incorrect passphrase.')
    }
  }, [cipherEnvelope])

  const setHaUrl = useCallback(async (url) => {
    const { error: dbErr } = await supabase
      .from('user_secrets')
      .upsert(
        { user_id: userId, ha_url: url, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )
    if (dbErr) throw dbErr
    setHaUrlState(url)
  }, [userId])

  const setToken = useCallback(async (plaintext, { mode: newMode, passphrase }) => {
    const envelope = await encryptToken(plaintext, { mode: newMode, passphrase, userId })
    const { error: dbErr } = await supabase
      .from('user_secrets')
      .upsert(
        { user_id: userId, ha_token_encrypted: envelope, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )
    if (dbErr) throw dbErr
    setCipherEnvelope(envelope)
    setMode(newMode)
    setPlaintextToken(plaintext)
    setStatus('unlocked')
    setError(null)
  }, [userId])

  const changeMode = useCallback(async (newMode, passphrase) => {
    if (!plaintextToken) throw new Error('Token must be unlocked to change mode.')
    await setToken(plaintextToken, { mode: newMode, passphrase })
  }, [plaintextToken, setToken])

  // Delete DB row and reset all state — full re-pair required
  const clear = useCallback(async () => {
    const { error: dbErr } = await supabase
      .from('user_secrets')
      .delete()
      .eq('user_id', userId)
    if (dbErr) throw dbErr
    setCipherEnvelope(null)
    setMode(null)
    setPlaintextToken(null)
    setHaUrlState(null)
    setUnlockRequested(false)
    setError(null)
    setStatus('unconfigured')
  }, [userId])

  // Clear plaintext from memory only; encrypted blob stays in DB
  const forgetOnDevice = useCallback(() => {
    setPlaintextToken(null)
    if (mode === 'passphrase') {
      setStatus('locked')
    } else {
      loadFromDb() // auto-mode: re-decrypt immediately
    }
  }, [mode, loadFromDb])

  // Called by hooks that need HA when status is locked — triggers HaUnlockModal
  const requestUnlock = useCallback(() => {
    if (status === 'locked') setUnlockRequested(true)
  }, [status])

  return (
    <HaTokenContext.Provider value={{
      cipherEnvelope, mode, plaintextToken, status, error, haUrl,
      unlockRequested,
      loadFromDb, unlock, setToken, changeMode, clear, forgetOnDevice, requestUnlock, setError, setHaUrl,
    }}>
      {children}
    </HaTokenContext.Provider>
  )
}

export function useHaToken() {
  const ctx = useContext(HaTokenContext)
  if (!ctx) return {
    cipherEnvelope: null, mode: null, plaintextToken: null, status: 'unconfigured',
    error: null, haUrl: null, unlockRequested: false,
    loadFromDb: () => {}, unlock: () => {}, setToken: () => {}, changeMode: () => {},
    clear: () => {}, forgetOnDevice: () => {}, requestUnlock: () => {}, setError: () => {},
    setHaUrl: async () => {},
  }
  return ctx
}
