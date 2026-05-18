import { useState, useEffect, useRef, useCallback } from 'react'

const POLL_MS = 10000

const ENTITIES = {
  wifi:   'switch.gl_inet_axt1800_chomp_wifi',
  cpu:    'sensor.gl_inet_axt1800_cpu_temperature',
  memory: 'sensor.gl_inet_axt1800_memory_usage',
  uptime: 'sensor.gl_inet_axt1800_uptime',
  flash:  'sensor.gl_inet_axt1800_flash_usage',
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

  const haUrl = localStorage.getItem('vela-ha-url') ?? ''
  const haToken = localStorage.getItem('vela-ha-token') ?? ''
  const isConfigured = !!(haUrl && haToken)

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
    fetchAll()
    const interval = setInterval(fetchAll, POLL_MS)
    return () => {
      cancelRef.current = true
      clearInterval(interval)
    }
  }, [fetchAll])

  const wifiOn = data?.wifi?.state === 'on'
  const cpuTempF = parseFloat(data?.cpu?.state)
  const memoryPct = parseFloat(data?.memory?.state)
  const flashPct = parseFloat(data?.flash?.state)
  const uptimeIso = data?.uptime?.state

  return {
    loading, error, lastUpdated, isConfigured,
    wifiOn,
    cpuTempF: Number.isFinite(cpuTempF) ? cpuTempF : null,
    memoryPct: Number.isFinite(memoryPct) ? memoryPct : null,
    flashPct: Number.isFinite(flashPct) ? flashPct : null,
    uptimeIso,
    refetch: fetchAll,
  }
}
