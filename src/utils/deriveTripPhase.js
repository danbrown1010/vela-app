// Pure function — no React, no side effects

// [lng, lat] tuple → [lng, lat] tuple, result in miles
function haversine([lng1, lat1], [lng2, lat2]) {
  const R    = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// TODO: add home_lat/home_lng to profiles schema and remove this fallback
const KIRKLAND = [-122.2087, 47.6815]  // [lng, lat]

function pickCurrentTrip(activeTrip, trips, now) {
  // 1. Authoritative pointer — user explicitly selected this trip
  if (activeTrip) return activeTrip

  // 2. After hard reload, activeTrip resets to null but status persists in DB
  const reloadedActive = trips.find(t => t.status === 'pre-trip')
  if (reloadedActive) return reloadedActive

  // 3. Upcoming planning trip with soonest departure
  const upcoming = trips
    .filter(t => t.status === 'planning' && t.departureDate)
    .filter(t => new Date(t.departureDate + 'T00:00:00').getTime() > now)
    .sort((a, b) =>
      new Date(a.departureDate + 'T00:00:00').getTime() -
      new Date(b.departureDate + 'T00:00:00').getTime()
    )[0]
  if (upcoming) return upcoming

  // 4. Recently completed — within 48h of end-of-return-day
  const recentlyDone = trips
    .filter(t => t.status === 'completed' && t.returnDate)
    .filter(t => {
      const endMs = new Date(t.returnDate + 'T23:59:59').getTime()
      return now > endMs && (now - endMs) < 48 * 3600000
    })
    .sort((a, b) =>
      new Date(b.returnDate + 'T23:59:59').getTime() -
      new Date(a.returnDate + 'T23:59:59').getTime()
    )[0]
  if (recentlyDone) return recentlyDone

  return null
}

export function deriveTripPhase({
  activeTrip  = null,
  trips       = [],
  location    = null,
  profile     = null,
  now         = Date.now(),
} = {}) {
  const homeCoords = (profile?.home_lng != null && profile?.home_lat != null)
    ? [profile.home_lng, profile.home_lat]
    : KIRKLAND

  const distanceFromHomeMi =
    location?.lat != null && location?.lng != null
      ? haversine([location.lng, location.lat], homeCoords)
      : null

  const currentTrip = pickCurrentTrip(activeTrip, trips, now)

  const base = {
    currentTrip,
    distanceFromHomeMi,
    homeCoords,
    parkedDurationMin:  null,
    daysUntilDeparture: null,
    daysIntoTrip:       null,
    daysRemaining:      null,
  }

  if (!currentTrip) {
    return { ...base, stage: 'empty', phase: 'pre-trip', reason: 'no trips' }
  }

  // ── Planning trips: pre-departure stages ──────────────────────────────────
  if (currentTrip.status === 'planning') {
    const startMs  = new Date(currentTrip.departureDate + 'T00:00:00').getTime()
    const daysUntil = (startMs - now) / 86400000
    if (daysUntil > 1) {
      return {
        ...base,
        stage: 'ready',
        phase: 'pre-trip',
        daysUntilDeparture: daysUntil,
        reason: `departure in ${daysUntil.toFixed(1)}d`,
      }
    }
    return {
      ...base,
      stage: 'loaded',
      phase: 'pre-trip',
      daysUntilDeparture: Math.max(0, daysUntil),
      reason: 'departure within 24h',
    }
  }

  // ── Active trip (pre-trip status = currently selected) ────────────────────
  const isCurrentlySelected =
    currentTrip === activeTrip || currentTrip.status === 'pre-trip'

  if (isCurrentlySelected) {
    // No return date — can't compute end; default to parked
    if (!currentTrip.returnDate) {
      const startMs = currentTrip.departureDate
        ? new Date(currentTrip.departureDate + 'T00:00:00').getTime()
        : now
      return {
        ...base,
        stage: 'parked',
        phase: 'on-trip',
        daysIntoTrip: Math.max(0, (now - startMs) / 86400000),
        reason: 'active, no return date set',
      }
    }

    const startMs  = new Date(currentTrip.departureDate + 'T00:00:00').getTime()
    const endMs    = new Date(currentTrip.returnDate    + 'T23:59:59').getTime()
    const daysInto = Math.max(0, (now - startMs) / 86400000)
    const daysLeft = Math.max(0, (endMs - now)   / 86400000)

    // Unloading: past return date AND within 5mi of home
    if (now > endMs && distanceFromHomeMi != null && distanceFromHomeMi < 5) {
      return {
        ...base,
        stage: 'unloading',
        phase: 'post-trip',
        daysIntoTrip: daysInto,
        daysRemaining: 0,
        reason: `past end, ${distanceFromHomeMi.toFixed(1)} mi from home`,
      }
    }

    // Heading home: within 24h of return date OR past it (but not yet unloading)
    if (now > endMs - 86400000) {
      return {
        ...base,
        stage: 'heading',
        phase: 'on-trip',
        daysIntoTrip: daysInto,
        daysRemaining: Math.max(0, daysLeft),
        reason: 'within 24h of return date',
      }
    }

    // Travelling vs parked — coarse heuristic: m/s → mph
    const speedMph = location?.speed != null ? location.speed * 2.237 : 0
    if (speedMph > 5) {
      return {
        ...base,
        stage: 'travelling',
        phase: 'on-trip',
        daysIntoTrip: daysInto,
        daysRemaining: daysLeft,
        reason: `speed ${speedMph.toFixed(0)} mph`,
      }
    }
    return {
      ...base,
      stage: 'parked',
      phase: 'on-trip',
      daysIntoTrip: daysInto,
      daysRemaining: daysLeft,
      reason: speedMph > 0
        ? `speed ${speedMph.toFixed(0)} mph`
        : 'no speed signal, defaulting to parked',
    }
  }

  // ── Recently completed trip ───────────────────────────────────────────────
  if (currentTrip.status === 'completed') {
    const endMs = new Date(currentTrip.returnDate + 'T23:59:59').getTime()
    const hoursSinceEnd = (now - endMs) / 3600000
    if (hoursSinceEnd < 48) {
      return {
        ...base,
        stage: 'unloading',
        phase: 'post-trip',
        reason: `completed ${hoursSinceEnd.toFixed(0)}h ago`,
      }
    }
  }

  return { ...base, stage: 'empty', phase: 'pre-trip', reason: 'no active state' }
}
