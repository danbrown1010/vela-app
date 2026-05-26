import { useState, useEffect, useMemo, useRef } from 'react'
import { useHaToken } from '../store/haTokenStore'

const OBD_ENTITY_IDS = [
  'sensor.chomp_gps_latitude',
  'sensor.chomp_gps_longitude',
  'sensor.chomp_gps_altitude',
  'sensor.chomp_gps_bearing',
  'sensor.chomp_gps_speed',
  'sensor.chomp_gps_accuracy',
  'sensor.chomp_gps_satellites',
]

const ACCURACY_THRESHOLD_M = 9.144 // 30 ft
const STALE_MS = 30_000

export function useGpsSource() {
  const { plaintextToken, haUrl } = useHaToken()
  const token = plaintextToken ?? ''
  // TODO: dedupe with useHomeAssistant — see HANDOFF.md deferred
  const HA_URL = haUrl || import.meta.env.VITE_HA_URL || 'http://192.168.68.112:8123'

  const [obd, setObd] = useState(null)
  const [obdOnline, setObdOnline] = useState(false)
  const [browser, setBrowser] = useState(null)
  // Lazy init: avoid a synchronous setState-in-effect for the no-geolocation case
  const [browserError, setBrowserError] = useState(() =>
    typeof navigator !== 'undefined' && !navigator.geolocation ? 'unavailable' : null
  )
  const controllerRef = useRef(null)
  const browserErrLoggedRef = useRef(false)

  // OBD poller — passive, never calls requestUnlock
  useEffect(() => {
    if (!token) return

    const poll = async () => {
      if (controllerRef.current) controllerRef.current.abort()
      const ctrl = new AbortController()
      controllerRef.current = ctrl

      try {
        const res = await fetch(`${HA_URL}/api/states`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          signal: ctrl.signal,
        })
        if (!res.ok) throw new Error(`HA ${res.status}`)
        const allStates = await res.json()

        const byId = {}
        allStates
          .filter(e => OBD_ENTITY_IDS.includes(e.entity_id))
          .forEach(e => { byId[e.entity_id] = e })

        const parseNum = (id) => {
          const val = parseFloat(byId[id]?.state)
          return Number.isFinite(val) ? val : null
        }

        let freshestMs = 0
        OBD_ENTITY_IDS.forEach(id => {
          if (byId[id]?.last_updated) {
            const ms = new Date(byId[id].last_updated).getTime()
            if (ms > freshestMs) freshestMs = ms
          }
        })

        const lat = parseNum('sensor.chomp_gps_latitude')
        const lng = parseNum('sensor.chomp_gps_longitude')
        const altFt = parseNum('sensor.chomp_gps_altitude')
        const speedMph = parseNum('sensor.chomp_gps_speed')
        const accuracyFt = parseNum('sensor.chomp_gps_accuracy')
        const accuracy = accuracyFt != null ? accuracyFt * 0.3048 : null
        // Date.now() belongs here (async callback), not in the memo
        const ageMs = freshestMs ? Date.now() - freshestMs : Infinity

        setObd({
          lat,
          lng,
          altitude: altFt != null ? altFt * 0.3048 : null,
          heading: parseNum('sensor.chomp_gps_bearing'),
          speed: speedMph != null ? speedMph * 0.44704 : null,
          accuracy,
          satellites: parseNum('sensor.chomp_gps_satellites'),
          updatedAt: freshestMs || null,
        })
        setObdOnline(
          lat != null &&
          lng != null &&
          !(lat === 0 && lng === 0) &&
          accuracy != null &&
          accuracy < ACCURACY_THRESHOLD_M &&
          ageMs < STALE_MS
        )
      } catch (err) {
        if (err.name === 'AbortError') return
        console.warn('[useGpsSource OBD] fetch error:', err.message)
      }
    }

    poll()
    const interval = setInterval(poll, 5000)

    return () => {
      clearInterval(interval)
      if (controllerRef.current) controllerRef.current.abort()
    }
  }, [token, HA_URL])

  // Browser watcher — lazy init above handles the no-geolocation case
  useEffect(() => {
    if (!navigator.geolocation) return

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setBrowser({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude ?? null,
          heading: Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
          speed: Number.isFinite(pos.coords.speed) ? pos.coords.speed : null,
          updatedAt: pos.timestamp,
        })
        setBrowserError(null)
        browserErrLoggedRef.current = false
      },
      (err) => {
        if (!browserErrLoggedRef.current) {
          console.warn('[useGpsSource browser] GPS error:', err.code, err.message)
          browserErrLoggedRef.current = true
        }
        setBrowserError(err.code === 1 ? 'denied' : 'unavailable')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  return useMemo(() => {
    // Gate OBD on token: if token was cleared, treat as offline without a setState call
    const effectiveObdOnline = !!token && obdOnline
    const source = effectiveObdOnline ? 'obd' : (browser != null ? 'browser' : null)
    const selected = source === 'obd' ? obd : source === 'browser' ? browser : null

    return {
      lat:       selected?.lat      ?? null,
      lng:       selected?.lng      ?? null,
      accuracy:  selected?.accuracy ?? null,
      altitude:  selected?.altitude ?? null,
      heading:   selected?.heading  ?? null,
      speed:     selected?.speed    ?? null,
      timestamp: selected?.updatedAt ?? null,
      source,
      updatedAt:  selected?.updatedAt ?? null,
      obdOnline:  effectiveObdOnline,
      browserError,
      obd:     obd ?? null,
      browser: browser ?? null,
    }
  }, [token, obd, obdOnline, browser, browserError])
}
