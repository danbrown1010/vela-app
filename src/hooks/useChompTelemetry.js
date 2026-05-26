import { useHomeAssistant } from './useHomeAssistant'

// Entity IDs verified 2026-05-25 against HA Dev Tools
const OBD_IDS = [
  'sensor.chomp_fuel_level',
  'sensor.chomp_engine_coolant_temperature',
  'sensor.chomp_voltage_obd_adapter',
  'sensor.chomp_distance_to_empty_estimated',
  'sensor.chomp_trip_distance',         // per-trip odometer, resets on power cycle
  'sensor.chomp_ambient_air_temperature',
  'sensor.chomp_engine_rpm',
]

function parseNum(raw) {
  if (raw == null || raw === 'unavailable' || raw === 'unknown') return null
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : null
}

function parseDate(iso) {
  if (!iso) return null
  try { return new Date(iso) } catch { return null }
}

function toF(n, unit) {
  if (n === null) return null
  return unit === '°C' ? (n * 9 / 5) + 32 : n
}

function toMi(n, unit) {
  if (n === null) return null
  return (unit == null || unit === 'km') ? n * 0.621371 : n
}

// Pure derivation — accepts an ha result object so callers that already hold
// a useHomeAssistant() result can pass it in directly and avoid a second poll loop.
export function deriveChompTelemetry(ha) {
  const ent  = ha?.entities ?? {}
  const get  = (id) => parseNum(ent[id]?.state)
  const unit = (id) => ent[id]?.attributes?.unit_of_measurement ?? null
  const ts   = (id) => parseDate(ent[id]?.last_updated)

  const isOnline = (ha?.connected ?? false) && OBD_IDS.some(id => {
    const s = ent[id]?.state
    return s != null && s !== 'unavailable' && s !== 'unknown'
  })

  // ── Fuel ────────────────────────────────────────────────────────────────────
  const fuelPct       = get('sensor.chomp_fuel_level')
  const distToEmptyMi = toMi(
    get('sensor.chomp_distance_to_empty_estimated'),
    unit('sensor.chomp_distance_to_empty_estimated'),
  )
  const fuel = (fuelPct !== null || distToEmptyMi !== null)
    ? { percent: fuelPct, distanceToEmptyMi: distToEmptyMi, lastUpdated: ts('sensor.chomp_fuel_level') }
    : null

  // ── Engine ──────────────────────────────────────────────────────────────────
  const coolantF = toF(
    get('sensor.chomp_engine_coolant_temperature'),
    unit('sensor.chomp_engine_coolant_temperature'),
  )
  const batteryV = get('sensor.chomp_voltage_obd_adapter')
  const rpm      = get('sensor.chomp_engine_rpm')

  let engineStatus = null
  if (coolantF !== null) {
    if (coolantF > 240)       engineStatus = 'critical'
    else if (coolantF >= 220) engineStatus = 'warning'
    else                      engineStatus = 'normal'
  }

  const engine = (coolantF !== null || batteryV !== null || rpm !== null)
    ? { coolantF, batteryV, rpm, status: engineStatus, lastUpdated: ts('sensor.chomp_engine_coolant_temperature') }
    : null

  // ── Trip distance (per-trip odometer, resets on power cycle) ────────────────
  const tripMi = toMi(get('sensor.chomp_trip_distance'), unit('sensor.chomp_trip_distance'))
  const tripDistance = tripMi !== null
    ? { miles: tripMi, lastUpdated: ts('sensor.chomp_trip_distance') }
    : null

  // ── Outside temp ────────────────────────────────────────────────────────────
  const outsideTempF = toF(
    get('sensor.chomp_ambient_air_temperature'),
    unit('sensor.chomp_ambient_air_temperature'),
  )

  return { isOnline, fuel, engine, tripDistance, outsideTempF }
}

// Hook for components that don't already hold a useHomeAssistant() result.
export function useChompTelemetry() {
  const ha = useHomeAssistant()
  return deriveChompTelemetry(ha)
}
