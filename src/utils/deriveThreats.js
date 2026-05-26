// Pure function — no React, no side effects
import { haversineKm } from './geo'

const KM_PER_MI = 1.60934

export function deriveThreats({ weather, safety, position } = {}) {
  if (!position?.lat || !position?.lng) return []

  const userLat = position.lat
  const userLng = position.lng
  const threats = []

  // NWS weather alerts (already filtered to user's point by the API)
  for (const alert of (weather?.alerts ?? [])) {
    const p = alert.properties
    if (!p) continue

    const event    = p.event    ?? ''
    const severity = p.severity ?? 'Unknown'
    const urgency  = p.urgency  ?? 'Unknown'

    let base = 30
    if (/emergency/i.test(event)) base = 90
    else if (/warning/i.test(event)) base = 70
    else if (/watch/i.test(event))   base = 50

    if (severity === 'Extreme') base += 10
    else if (severity === 'Severe') base += 5
    if (urgency === 'Immediate') base += 5

    const priority = Math.min(99, base)

    threats.push({
      id:         p.id ?? `alert-${event}-${p.effective ?? ''}`,
      type:       'weather_alert',
      severity:   severity.toLowerCase(),
      headline:   p.headline ?? event ?? 'Weather Alert',
      detail:     p.description ?? '',
      distanceMi: null,
      bearing:    null,
      trajectory: null,
      source:     'nws',
      priority,
      actionable: priority >= 60,
      surface:    surfaceFor(priority),
    })
  }

  // NIFC active fire perimeters
  for (const fire of (safety?.fires?.features ?? [])) {
    if (!fire.geometry) continue
    const centroid = polygonCentroid(fire.geometry)
    if (!centroid) continue

    const distMi = haversineKm(userLat, userLng, centroid.lat, centroid.lng) / KM_PER_MI
    const bear   = bearingDeg(userLat, userLng, centroid.lat, centroid.lng)

    let priority
    if (distMi < 10)       priority = 88
    else if (distMi < 25)  priority = 82
    else if (distMi < 50)  priority = 72
    else if (distMi < 100) priority = 58
    else                   priority = 20

    const acres    = fire.properties?.GISAcres
    const acresStr = acres != null ? ` (${Math.round(acres).toLocaleString()} acres)` : ''
    const name     = fire.properties?.IncidentName ?? 'Active Wildfire'

    threats.push({
      id:         `fire-${name.toLowerCase().replace(/\s+/g, '-')}-${distMi.toFixed(0)}mi`,
      type:       'wildfire',
      severity:   distMi < 25 ? 'extreme' : distMi < 50 ? 'severe' : 'moderate',
      headline:   name,
      detail:     `Active fire perimeter${acresStr} — ${distMi.toFixed(0)} mi away`,
      distanceMi: distMi,
      bearing:    bear,
      trajectory: null,
      source:     'nifc',
      priority,
      actionable: priority >= 60,
      surface:    surfaceFor(priority),
    })
  }

  // AQI
  const aqiData = safety?.aqi
  if (aqiData?.aqi != null) {
    const v = aqiData.aqi
    let priority = 0
    if (v >= 301)      priority = 75
    else if (v >= 201) priority = 65
    else if (v >= 151) priority = 50
    else if (v >= 101) priority = 35
    else if (v >= 51)  priority = 10

    if (priority > 0) {
      threats.push({
        id:         `aqi-${aqiData.dateObserved ?? 'now'}-${aqiData.hourObserved ?? ''}`,
        type:       'air_quality',
        severity:   v >= 301 ? 'extreme' : v >= 201 ? 'severe' : v >= 151 ? 'moderate' : 'minor',
        headline:   `Air Quality: ${aqiData.category}`,
        detail:     `AQI ${v} (${aqiData.pollutant}) — ${aqiData.reportingArea}, ${aqiData.stateCode}`,
        distanceMi: null,
        bearing:    null,
        trajectory: null,
        source:     'airnow',
        priority,
        actionable: priority >= 50,
        surface:    surfaceFor(priority),
      })
    }
  }

  // WA DNR burn bans
  for (const ban of (safety?.burnBans ?? [])) {
    const status = ban.properties?.BurnBanStatus
    if (!status || /no restriction/i.test(status)) continue

    const county = ban.properties?.CountyName ?? 'Local Area'
    threats.push({
      id:         `burnban-${county.toLowerCase().replace(/\s+/g, '-')}`,
      type:       'burn_ban',
      severity:   'moderate',
      headline:   `Burn Ban: ${county}`,
      detail:     `${status} — effective ${ban.properties?.EffectiveDate ?? 'unknown'}`,
      distanceMi: null,
      bearing:    null,
      trajectory: null,
      source:     'wa_dnr',
      priority:   40,
      actionable: true,
      surface:    surfaceFor(40),
    })
  }

  return threats.sort((a, b) => b.priority - a.priority)
}

function surfaceFor(priority) {
  if (priority >= 60) return ['home', 'map', 'safety']
  if (priority >= 30) return ['map', 'safety']
  return ['safety']
}

function bearingDeg(lat1, lng1, lat2, lng2) {
  const dLng = (lng2 - lng1) * Math.PI / 180
  const la1  = lat1 * Math.PI / 180
  const la2  = lat2 * Math.PI / 180
  const y    = Math.sin(dLng) * Math.cos(la2)
  const x    = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360
}

function polygonCentroid(geometry) {
  let coords
  if (geometry.type === 'Polygon') {
    coords = geometry.coordinates[0]
  } else if (geometry.type === 'MultiPolygon') {
    let maxLen = 0
    for (const poly of geometry.coordinates) {
      if (poly[0].length > maxLen) { maxLen = poly[0].length; coords = poly[0] }
    }
  }
  if (!coords?.length) return null
  const n = coords.length
  return {
    lat: coords.reduce((s, c) => s + c[1], 0) / n,
    lng: coords.reduce((s, c) => s + c[0], 0) / n,
  }
}
