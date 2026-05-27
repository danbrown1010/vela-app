export const METRIC_RANGES = {
  coolantF:      { min: 120, max: 260 },
  batteryV:      { min: 11.5, max: 15.0 },
  rpm:           { min: 0, max: 6000 },
  fuelPercent:   { min: 0, max: 100 },
  distToEmptyMi: { min: 0, max: 400 },
  tripMi:        { min: 0, max: 500 },
  outsideTempF:  { min: -20, max: 120 },
  speed:         { min: 0, max: 120 },
  altitude:      { min: 0, max: 10000 },
  heading:       { min: 0, max: 360 },
  accuracy:      { min: 0, max: 300 },
  satellites:    { min: 0, max: 20 },
  lat:           { min: null, max: null },
  lng:           { min: null, max: null },
}

// ctx: { rpm } — needed for battery voltage thresholds (running vs idle)
export function toneFor(metric, value, ctx = {}) {
  if (value == null) return 'neutral'
  switch (metric) {
    case 'coolantF':
      if (value > 240) return 'critical'
      if (value >= 220) return 'warning'
      return 'neutral'
    case 'batteryV': {
      const running = (ctx.rpm ?? 0) > 0
      if (running) {
        if (value < 12.5) return 'critical'
        if (value < 13.0) return 'warning'
      } else {
        if (value < 12.0) return 'critical'
        if (value < 12.4) return 'warning'
      }
      return 'connected'
    }
    case 'rpm':
      return value > 0 ? 'connected' : 'neutral'
    case 'fuelPercent':
      if (value < 10) return 'critical'
      if (value < 20) return 'warning'
      return 'neutral'
    case 'distToEmptyMi':
      if (value < 20) return 'critical'
      if (value < 50) return 'warning'
      return 'neutral'
    case 'satellites':
      if (value < 4) return 'critical'
      if (value < 6) return 'warning'
      return 'connected'
    case 'accuracy':
      if (value > 100) return 'warning'
      return 'neutral'
    default:
      return 'neutral'
  }
}

export function statusWordFor(metric, value, ctx = {}) {
  if (value == null) return null
  switch (metric) {
    case 'coolantF':
      if (value > 240) return 'CRITICAL'
      if (value >= 220) return 'HOT'
      if (value >= 160) return 'NORMAL'
      return 'WARMING'
    case 'batteryV': {
      const running = (ctx.rpm ?? 0) > 0
      if (running) {
        if (value < 12.5) return 'CRITICAL'
        if (value < 13.0) return 'LOW'
        return 'CHARGING'
      } else {
        if (value < 12.0) return 'CRITICAL'
        if (value < 12.4) return 'LOW'
        return 'IDLE'
      }
    }
    case 'rpm':
      return value > 0 ? 'RUNNING' : 'OFF'
    case 'fuelPercent':
      if (value < 10) return 'CRITICAL'
      if (value < 20) return 'LOW'
      return 'OK'
    case 'distToEmptyMi':
      if (value < 20) return 'CRITICAL'
      if (value < 50) return 'LOW'
      return 'OK'
    case 'satellites':
      if (value < 4) return 'NO FIX'
      if (value < 6) return 'WEAK'
      return 'LOCKED'
    case 'accuracy':
      if (value > 100) return 'POOR'
      if (value > 30) return 'FAIR'
      return 'GOOD'
    default:
      return null
  }
}
