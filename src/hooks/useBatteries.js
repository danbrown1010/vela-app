import { useState, useEffect, useRef, useCallback } from 'react'
import { useHaToken } from '../store/haTokenStore'

const POLL_MS = 30000

const BATTERIES = [
  { id: 'outside',      entityId: 'sensor.outside_battery',      label: 'Outside'      },
  { id: 'cabin',        entityId: 'sensor.cabin_battery',         label: 'Cabin'        },
  { id: 'ursa_minor',   entityId: 'sensor.ursa_minor_2_battery',   label: 'Ursa Minor'   },
  { id: 'refrigerator', entityId: 'sensor.iceco_fridge_battery',   label: 'Refrigerator' },
]

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

export function useBatteries() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const cancelRef = useRef(false)

  const { plaintextToken, haUrl } = useHaToken()
  const haToken = plaintextToken ?? ''
  const isConfigured = !!(haUrl && haToken)

  const fetchAll = useCallback(async () => {
    if (!isConfigured) {
      setLoading(false)
      return
    }
    try {
      const results = await Promise.all(
        BATTERIES.map(async ({ id, entityId }) => {
          try {
            const state = await fetchState(haUrl, haToken, entityId)
            return [id, state]
          } catch {
            return [id, { state: 'unavailable' }]
          }
        })
      )
      if (cancelRef.current) return
      setData(Object.fromEntries(results))
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

  const batteries = BATTERIES.map(({ id, label }) => {
    const raw = parseFloat(data?.[id]?.state)
    return { id, label, soc: Number.isFinite(raw) ? raw : null }
  })

  return { batteries, loading, error, lastUpdated, isConfigured, refetch: fetchAll }
}
