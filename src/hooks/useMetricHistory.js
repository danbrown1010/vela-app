import { useEffect, useRef, useState } from 'react'

/**
 * Tracks last N samples of a numeric value over time.
 * Skips null/NaN. Dedupes consecutive identical values within 1s
 * to suppress OBD sample noise on unchanged readings.
 *
 * @param value       current numeric value (null/undefined skips sample)
 * @param maxSamples  ring buffer size, default 60
 * @returns { samples: Array<{ t: number, v: number }>, oldestT, newestT }
 */
export function useMetricHistory(value, maxSamples = 60) {
  const lastEntryRef = useRef(null)  // only accessed inside effect — not during render
  const [samples, setSamples] = useState([])

  useEffect(() => {
    if (value == null) return
    const num = Number(value)
    if (!Number.isFinite(num)) return

    const t = Date.now()
    const last = lastEntryRef.current
    if (last && last.v === num && t - last.t < 1000) return

    const entry = { t, v: num }
    lastEntryRef.current = entry
    setSamples(prev => [...prev, entry].slice(-maxSamples))
  }, [value, maxSamples])

  return {
    samples,
    oldestT: samples[0]?.t ?? null,
    newestT: samples[samples.length - 1]?.t ?? null,
  }
}
