// Two exports coexist:
//   useWeather(lat, lng)      — polled NWS forecast + alerts; used by AppContext
//   useFireWeather(lat, lng)  — one-shot fire-specific alerts; used directly by SafetyPage

import { useState, useEffect, useRef } from 'react'

const UA = 'vela-go.com (dan@vela-go.com)'
const FORECAST_POLL_MS = 15 * 60 * 1000
const ALERTS_ACTIVE_MS =  5 * 60 * 1000
const ALERTS_IDLE_MS   = 15 * 60 * 1000
const CACHE_TTL_MS     = 30 * 60 * 1000

export function useWeather(lat, lng) {
  // Seed initial state from cache once on mount (startup hint — does not re-run on lat/lng change)
  const [cachedSeed] = useState(() => {
    if (!lat || !lng) return null
    try {
      const k = `vela-weather-${Math.round(lat * 10)}-${Math.round(lng * 10)}`
      const t = localStorage.getItem(`${k}-time`)
      if (!t || Date.now() - parseInt(t) >= CACHE_TTL_MS) return null
      const raw = localStorage.getItem(k)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })

  const [current,   setCurrent]   = useState(cachedSeed?.current ?? null)
  const [hourly,    setHourly]    = useState(cachedSeed?.hourly  ?? null)
  const [daily,     setDaily]     = useState(cachedSeed?.daily   ?? null)
  const [alerts,    setAlerts]    = useState([])
  const [loading,   setLoading]   = useState(!cachedSeed)
  const [error,     setError]     = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)

  // alertsRef lets the timeout-based alerts interval read current alert count without a dep
  const alertsRef = useRef([])
  useEffect(() => { alertsRef.current = alerts }, [alerts])

  // Forecast: resolve grid point once per lat/lng, then poll every 15 min
  useEffect(() => {
    if (!lat || !lng) return
    const ctrl = new AbortController()
    let resolvedForecastUrl = null
    let resolvedHourlyUrl   = null

    const poll = async () => {
      try {
        if (!resolvedForecastUrl) {
          const r = await fetch(
            `https://api.weather.gov/points/${lat.toFixed(4)},${lng.toFixed(4)}`,
            { headers: { 'User-Agent': UA }, signal: ctrl.signal }
          )
          if (!r.ok) throw new Error(`NWS points ${r.status}`)
          const d = await r.json()
          resolvedForecastUrl = d.properties.forecast
          resolvedHourlyUrl   = d.properties.forecastHourly
        }

        const [dRes, hRes] = await Promise.all([
          fetch(resolvedForecastUrl, { headers: { 'User-Agent': UA }, signal: ctrl.signal }),
          fetch(resolvedHourlyUrl,   { headers: { 'User-Agent': UA }, signal: ctrl.signal }),
        ])
        if (!dRes.ok) throw new Error(`NWS daily ${dRes.status}`)
        if (!hRes.ok) throw new Error(`NWS hourly ${hRes.status}`)

        const [dData, hData] = await Promise.all([dRes.json(), hRes.json()])
        const newCurrent = hData.properties.periods[0]        ?? null
        const newHourly  = hData.properties.periods.slice(0, 24)
        const newDaily   = dData.properties.periods.slice(0, 7)

        setCurrent(newCurrent)
        setHourly(newHourly)
        setDaily(newDaily)
        setUpdatedAt(Date.now())
        setLoading(false)
        setError(null)

        const k = `vela-weather-${Math.round(lat * 10)}-${Math.round(lng * 10)}`
        localStorage.setItem(k, JSON.stringify({ current: newCurrent, hourly: newHourly, daily: newDaily }))
        localStorage.setItem(`${k}-time`, Date.now().toString())
      } catch (err) {
        if (err.name === 'AbortError') return
        setError(err.message)
        setLoading(false)
      }
    }

    poll()
    const id = setInterval(poll, FORECAST_POLL_MS)
    return () => { ctrl.abort(); clearInterval(id) }
  }, [lat, lng])

  // Alerts: 5-min poll when active, 15-min when quiet
  useEffect(() => {
    if (!lat || !lng) return
    const ctrl = new AbortController()
    let id

    const tick = async () => {
      try {
        const r = await fetch(
          `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lng.toFixed(4)}`,
          { headers: { 'User-Agent': UA }, signal: ctrl.signal }
        )
        if (!r.ok) throw new Error(`NWS alerts ${r.status}`)
        const d = await r.json()
        setAlerts(d.features ?? [])
      } catch (err) {
        if (err.name !== 'AbortError') console.warn('[useWeather alerts]', err.message)
      }
      if (ctrl.signal.aborted) return
      const delay = alertsRef.current.length > 0 ? ALERTS_ACTIVE_MS : ALERTS_IDLE_MS
      id = setTimeout(tick, delay)
    }

    tick()
    return () => { ctrl.abort(); clearTimeout(id) }
  }, [lat, lng])

  return { current, hourly, daily, alerts, loading, error, updatedAt }
}

export function useFireWeather(lat, lng) {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!lat || !lng) return

    fetch(
      `https://api.weather.gov/alerts/active` +
      `?point=${lat.toFixed(4)},${lng.toFixed(4)}` +
      `&event=Red%20Flag%20Warning,Fire%20Weather%20Watch,Extreme%20Fire%20Behavior`,
      { headers: { 'User-Agent': UA } }
    )
      .then(r => r.json())
      .then(data => {
        setAlerts(data.features || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [lat, lng])

  return { alerts, loading }
}
