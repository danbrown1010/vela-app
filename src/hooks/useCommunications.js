import { useState, useEffect, useRef, useCallback } from 'react'
import { useHaToken } from '../store/haTokenStore'
import { isOnWifi, onNetworkChange } from '../utils/networkType'

const POLL_MS = 30000

const ENTITIES = {
  wifi:           'switch.gl_inet_axt1800_chomp_wifi',
  cpu:            'sensor.gl_inet_axt1800_cpu_temperature',
  memory:         'sensor.gl_inet_axt1800_memory_usage',
  uptime:         'sensor.gl_inet_axt1800_uptime',
  flash:          'sensor.gl_inet_axt1800_flash_usage',
  speedtestDown:  'sensor.speedtest_download',
  speedtestUp:    'sensor.speedtest_upload',
  speedtestPing:  'sensor.speedtest_ping',
}

async function fetchState(haUrl, token, entityId) {
  const res = await fetch(
    `${haUrl.replace(/\/$/, '')}/api/states/${entityId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    }
  )
  if (!res.ok) throw new Error(`HA ${res.status} for ${entityId}`)
  return res.json()
}

export function useCommunications() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const cancelRef = useRef(false)

  const { plaintextToken, haUrl, status: haStatus, requestUnlock } = useHaToken()
  const haToken = plaintextToken ?? ''
  const isConfigured = !!(haUrl && haToken)

  // Trigger the unlock modal when the token exists but requires a passphrase
  useEffect(() => {
    if (haStatus === 'locked') requestUnlock()
  }, [haStatus, requestUnlock])

  const fetchAll = useCallback(async () => {
    if (!isConfigured) {
      setLoading(false)
      setError('Home Assistant not configured')
      return
    }
    try {
      const results = await Promise.all(
        Object.entries(ENTITIES).map(async ([key, id]) => {
          try {
            const state = await fetchState(haUrl, haToken, id)
            return [key, state]
          } catch (err) {
            return [key, { state: 'unavailable', error: err.message }]
          }
        })
      )
      if (cancelRef.current) return
      const next = Object.fromEntries(results)
      setData(next)
      setLastUpdated(new Date())
      setError(null)
      setLoading(false)
    } catch (err) {
      if (cancelRef.current) return
      setError(err.message)
      setLoading(false)
    }
  }, [haUrl, haToken, isConfigured])

  useEffect(() => {
    cancelRef.current = false

    if (isOnWifi()) fetchAll()

    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible' || !isOnWifi()) return
      fetchAll()
    }, POLL_MS)

    const handleResume = () => {
      if (!isOnWifi() || document.visibilityState !== 'visible') return
      fetchAll()
    }
    document.addEventListener('visibilitychange', handleResume)
    const removeNetListener = onNetworkChange(handleResume)

    return () => {
      cancelRef.current = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleResume)
      removeNetListener()
    }
  }, [fetchAll])

  const wifiOn = data?.wifi?.state === 'on'
  const cpuTempF = parseFloat(data?.cpu?.state)
  const memoryPct = parseFloat(data?.memory?.state)
  const flashPct = parseFloat(data?.flash?.state)
  const uptimeIso = data?.uptime?.state
  const speedtestDown = parseFloat(data?.speedtestDown?.state)
  const speedtestUp = parseFloat(data?.speedtestUp?.state)
  const speedtestPing = parseFloat(data?.speedtestPing?.state)

  return {
    loading, error, lastUpdated, isConfigured, haStatus,
    wifiOn,
    cpuTempF: Number.isFinite(cpuTempF) ? cpuTempF : null,
    memoryPct: Number.isFinite(memoryPct) ? memoryPct : null,
    flashPct: Number.isFinite(flashPct) ? flashPct : null,
    uptimeIso,
    speedtestDown: Number.isFinite(speedtestDown) ? speedtestDown : null,
    speedtestUp: Number.isFinite(speedtestUp) ? speedtestUp : null,
    speedtestPing: Number.isFinite(speedtestPing) ? speedtestPing : null,
    refetch: fetchAll,
  }
}
