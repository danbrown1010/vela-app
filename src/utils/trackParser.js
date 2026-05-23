import { gpx, kml } from '@tmcw/togeojson'
import length from '@turf/length'
import bbox from '@turf/bbox'
import simplify from '@turf/simplify'
import { featureCollection, lineString } from '@turf/helpers'

// Returns { geojson, pointCount, distanceM, bboxArr } or throws on parse error.
export function parseTrackFile(text, filename) {
  const ext = filename.split('.').pop().toLowerCase()

  let fc
  if (ext === 'gpx') {
    fc = parseGpx(text)
  } else if (ext === 'kml') {
    fc = parseKml(text)
  } else if (ext === 'geojson' || ext === 'json') {
    fc = parseGeoJson(text)
  } else {
    throw new Error(`Unsupported format: .${ext}`)
  }

  if (!fc.features.length) throw new Error('No track features found in file')

  const pointCount = countPoints(fc)
  const distanceM = computeDistanceM(fc)
  const bboxArr = bbox(fc)

  return { geojson: fc, pointCount, distanceM, bboxArr }
}

// Apply Douglas-Peucker simplification (toleranceM in meters → degrees approx).
// Pure + synchronous — caller is responsible for yielding to the event loop
// before calling this on large datasets.
export function simplifyTrack(fc, toleranceM) {
  const toleranceDeg = toleranceM / 111320

  // Sanitise features before handing to turf/simplify:
  // - drop null-geometry features (turf throws on them)
  // - deduplicate consecutive identical coordinates (can produce 1-pt lines)
  // - drop LineStrings that still have < 2 points after dedup
  const safe = {
    ...fc,
    features: fc.features
      .filter(f => f.geometry != null)
      .map(f => {
        const g = f.geometry
        if (g.type !== 'LineString') return f
        const coords = dedupeCoords(g.coordinates)
        if (coords.length < 2) return null
        return coords.length === g.coordinates.length
          ? f
          : { ...f, geometry: { ...g, coordinates: coords } }
      })
      .filter(Boolean),
  }

  let simplified
  try {
    simplified = simplify(safe, { tolerance: toleranceDeg, highQuality: false, mutate: false })
  } catch (err) {
    console.warn('[simplifyTrack] turf/simplify threw, returning original geometry:', err.message)
    return fc
  }

  // Per-feature fallback: if simplify collapsed a LineString below 2 points
  // (possible with very high tolerance), restore the sanitised original.
  const features = simplified.features.map((sf, i) => {
    const g = sf.geometry
    if (g?.type === 'LineString' && g.coordinates.length < 2) {
      console.warn('[simplifyTrack] feature', i, 'collapsed to < 2 pts, using pre-simplify version')
      return safe.features[i] ?? sf
    }
    return sf
  })

  return { ...simplified, features }
}

function dedupeCoords(coords) {
  if (coords.length === 0) return coords
  const out = [coords[0]]
  for (let i = 1; i < coords.length; i++) {
    const prev = out[out.length - 1]
    const curr = coords[i]
    if (curr[0] !== prev[0] || curr[1] !== prev[1]) out.push(curr)
  }
  return out
}

export function sourceFormat(filename) {
  const ext = filename.split('.').pop().toLowerCase()
  if (ext === 'gpx') return 'gpx'
  if (ext === 'kml') return 'kml'
  return 'geojson'
}

// ── Private helpers ──────────────────────────────────────────────────────────

function parseGpx(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  const err = doc.querySelector('parsererror')
  if (err) throw new Error('Invalid GPX: ' + err.textContent.slice(0, 80))
  return gpx(doc)
}

function parseKml(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  const err = doc.querySelector('parsererror')
  if (err) throw new Error('Invalid KML: ' + err.textContent.slice(0, 80))
  return kml(doc)
}

function parseGeoJson(text) {
  let parsed
  try { parsed = JSON.parse(text) } catch { throw new Error('Invalid JSON') }

  if (parsed.type === 'FeatureCollection') return parsed
  if (parsed.type === 'Feature') return featureCollection([parsed])
  if (parsed.type === 'LineString' || parsed.type === 'MultiLineString') {
    return featureCollection([{ type: 'Feature', properties: {}, geometry: parsed }])
  }
  throw new Error('Unrecognised GeoJSON type: ' + parsed.type)
}

function countPoints(fc) {
  let total = 0
  for (const f of fc.features) {
    const g = f.geometry
    if (!g) continue
    if (g.type === 'LineString') total += g.coordinates.length
    else if (g.type === 'MultiLineString') g.coordinates.forEach(l => { total += l.length })
    else if (g.type === 'Point') total += 1
  }
  return total
}

function computeDistanceM(fc) {
  let totalKm = 0
  for (const f of fc.features) {
    const g = f.geometry
    if (!g) continue
    if (g.type === 'LineString') {
      totalKm += length(f, { units: 'kilometers' })
    } else if (g.type === 'MultiLineString') {
      for (const coords of g.coordinates) {
        totalKm += length(lineString(coords), { units: 'kilometers' })
      }
    }
  }
  return Math.round(totalKm * 1000)
}
