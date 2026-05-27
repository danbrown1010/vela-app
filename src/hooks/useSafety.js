import { useState, useEffect, useRef } from 'react'

const NIFC_POLL_MS     =  60 * 60 * 1000   // 60 min
const AQI_POLL_MS      =  30 * 60 * 1000   // 30 min
const BURN_BAN_POLL_MS =   6 * 60 * 60 * 1000  // 6 hours

const NIFC_BASE =
  'https://services3.arcgis.com/T4QMspbfLg3qoC1P/arcgis/rest/services/' +
  'WFIGS_Interagency_Perimeters_Current/FeatureServer/0'

// WA state bounding box for burn ban gate
const WA_BOUNDS = { minLat: 45.5, maxLat: 49.1, minLng: -124.8, maxLng: -116.9 }

function inWashington(lat, lng) {
  return (
    lat >= WA_BOUNDS.minLat && lat <= WA_BOUNDS.maxLat &&
    lng >= WA_BOUNDS.minLng && lng <= WA_BOUNDS.maxLng
  )
}

function nifcBboxUrl(lat, lng) {
  // Western US longitudes must be negative; guard against GPS sources that omit the sign
  const signedLng = lng > 0 ? -lng : lng
  const pad  = 1.5   // ~100 mi at PNW latitudes
  const xmin = signedLng - pad
  const ymin = lat - pad
  const xmax = signedLng + pad
  const ymax = lat + pad
  const params = new URLSearchParams({
    where:        '1=1',
    geometryType: 'esriGeometryEnvelope',
    spatialRel:   'esriSpatialRelIntersects',
    inSR:         '4326',
    outSR:        '4326',
    outFields:    '*',
    f:            'geojson',
  })
  // geometry commas must be literal — appended outside URLSearchParams to avoid encoding
  const url = `${NIFC_BASE}/query?${params.toString()}&geometry=${xmin},${ymin},${xmax},${ymax}`
  return url
}

// TODO: verify WA DNR burn restriction endpoint before relying on it
const WA_DNR_URL =
  'https://services.arcgis.com/jsIt88o09Q0r1j8h/arcgis/rest/services/' +
  'DNR_Burn_Restrictions/FeatureServer/0/query' +
  '?where=1%3D1&outFields=CountyName,BurnBanStatus,EffectiveDate,ExpirationDate&outSR=4326&f=geojson'

export function useSafety(lat, lng) {
  const [fires,    setFires]    = useState(null)
  const [burnBans, setBurnBans] = useState(null)
  const [aqi,      setAqi]      = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)

  // Track first NIFC attempt so we can clear the loading spinner
  const firesAttemptedRef = useRef(false)
  const aqiAttemptedRef   = useRef(false)

  // NIFC fire perimeters — bbox around current position
  useEffect(() => {
    if (!lat || !lng) return
    const ctrl = new AbortController()

    const poll = async () => {
      try {
        const bboxUrl = nifcBboxUrl(lat, lng)
        console.log('[NIFC bbox url]', bboxUrl)
        const r = await fetch(bboxUrl, { signal: ctrl.signal })
        if (!r.ok) throw new Error(`NIFC ${r.status}`)
        const data = await r.json()
        setFires(data)
        setUpdatedAt(Date.now())
      } catch (err) {
        if (err.name === 'AbortError') return
        console.warn('[useSafety NIFC]', err.message)
        setError(err.message)
      } finally {
        if (!ctrl.signal.aborted) {
          firesAttemptedRef.current = true
          if (aqiAttemptedRef.current) setLoading(false)
        }
      }
    }

    poll()
    const id = setInterval(poll, NIFC_POLL_MS)
    return () => { ctrl.abort(); clearInterval(id) }
  }, [lat, lng])

  // AirNow AQI
  useEffect(() => {
    if (!lat || !lng) return
    const key = import.meta.env.VITE_AIRNOW_API_KEY
    if (!key) return
    const ctrl = new AbortController()

    const poll = async () => {
      try {
        const url =
          `https://www.airnowapi.org/aq/observation/latLong/current/` +
          `?format=application/json` +
          `&latitude=${lat.toFixed(4)}` +
          `&longitude=${lng.toFixed(4)}` +
          `&distance=25` +
          `&API_KEY=${key}`
        const r = await fetch(url, { signal: ctrl.signal })
        if (!r.ok) throw new Error(`AirNow ${r.status}`)
        const data = await r.json()
        if (!data || data.length === 0) { setAqi(null) }
        else {
          const p = data.find(d => d.ParameterName === 'PM2.5') || data[0]
          setAqi({
            aqi:           p.AQI,
            category:      p.Category.Name,
            pollutant:     p.ParameterName,
            reportingArea: p.ReportingArea,
            stateCode:     p.StateCode,
            dateObserved:  p.DateObserved,
            hourObserved:  p.HourObserved,
          })
        }
      } catch (err) {
        if (err.name === 'AbortError') return
        console.warn('[useSafety AirNow]', err.message)
      } finally {
        if (!ctrl.signal.aborted) {
          aqiAttemptedRef.current = true
          if (firesAttemptedRef.current) setLoading(false)
        }
      }
    }

    poll()
    const id = setInterval(poll, AQI_POLL_MS)
    return () => { ctrl.abort(); clearInterval(id) }
  }, [lat, lng])

  // WA DNR burn bans — only when position is within Washington state
  useEffect(() => {
    if (!lat || !lng || !inWashington(lat, lng)) return
    const ctrl = new AbortController()

    const poll = async () => {
      try {
        const r = await fetch(WA_DNR_URL, { signal: ctrl.signal })
        if (!r.ok) throw new Error(`WA DNR ${r.status}`)
        const data = await r.json()
        setBurnBans(data.features ?? [])
      } catch (err) {
        if (err.name === 'AbortError') return
        console.warn('[useSafety burn bans]', err.message)
        setBurnBans(null)
      }
    }

    poll()
    const id = setInterval(poll, BURN_BAN_POLL_MS)
    return () => { ctrl.abort(); clearInterval(id) }
  }, [lat, lng])

  // Gate burn bans to WA only — avoids synchronous setState in the effect guard
  const effectiveBurnBans = (lat && lng && inWashington(lat, lng)) ? burnBans : null

  return { fires, burnBans: effectiveBurnBans, aqi, loading, error, updatedAt }
}
