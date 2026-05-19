import { useState, useEffect, useCallback } from 'react'
import { ECOFLOW_DEVICES } from '../config/devices'
import { getIntegration, saveIntegration } from '../utils/integrations'

const INTEGRATION = 'ecoflow'
const ALL_DEVICE_IDS = Object.keys(ECOFLOW_DEVICES)

const DEFAULTS = {
  visibleDeviceIds: ALL_DEVICE_IDS,
  featuredDeviceId: ALL_DEVICE_IDS[0], // delta2Max
}

export function useEcoflowConfig(userId) {
  const [visibleDeviceIds, setVisibleDeviceIds] = useState(ALL_DEVICE_IDS)
  const [featuredDeviceId, setFeaturedDeviceIdState] = useState(ALL_DEVICE_IDS[0])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    getIntegration(INTEGRATION, DEFAULTS).then((cfg) => {
      if (cancelled) return
      const valid = (cfg.visibleDeviceIds ?? ALL_DEVICE_IDS).filter((id) =>
        ALL_DEVICE_IDS.includes(id)
      )
      const visible = valid.length ? valid : ALL_DEVICE_IDS
      setVisibleDeviceIds(visible)

      // Featured must be one of the visible devices; otherwise fall to first visible
      const featuredFromCfg = cfg.featuredDeviceId
      const featured = visible.includes(featuredFromCfg)
        ? featuredFromCfg
        : visible[0] ?? null
      setFeaturedDeviceIdState(featured)
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [])

  // Internal: persist current state to Supabase
  const persist = useCallback(async (nextVisible, nextFeatured) => {
    await saveIntegration(
      INTEGRATION,
      { visibleDeviceIds: nextVisible, featuredDeviceId: nextFeatured },
      userId
    )
  }, [userId])

  const setVisible = async (nextIds) => {
    // Preserve canonical order
    const ordered = ALL_DEVICE_IDS.filter((id) => nextIds.includes(id))
    setVisibleDeviceIds(ordered)
    // If featured was removed, fall to first remaining
    let nextFeatured = featuredDeviceId
    if (!ordered.includes(featuredDeviceId)) {
      nextFeatured = ordered[0] ?? null
      setFeaturedDeviceIdState(nextFeatured)
    }
    await persist(ordered, nextFeatured)
  }

  const toggle = async (deviceId) => {
    const next = visibleDeviceIds.includes(deviceId)
      ? visibleDeviceIds.filter((id) => id !== deviceId)
      : [...visibleDeviceIds, deviceId]
    await setVisible(next)
  }

  const setFeatured = async (deviceId) => {
    if (!visibleDeviceIds.includes(deviceId)) return
    setFeaturedDeviceIdState(deviceId)
    await persist(visibleDeviceIds, deviceId)
  }

  const visibleDevices = visibleDeviceIds.map((id) => ({ id, ...ECOFLOW_DEVICES[id] }))
  const otherDevices = visibleDevices.filter((d) => d.id !== featuredDeviceId)
  const featuredDevice = visibleDevices.find((d) => d.id === featuredDeviceId) ?? null

  return {
    visibleDeviceIds,
    visibleDevices,
    allDevices: ALL_DEVICE_IDS.map((id) => ({ id, ...ECOFLOW_DEVICES[id] })),
    featuredDeviceId,
    featuredDevice,
    otherDevices,
    toggle,
    setVisible,
    setFeatured,
    loaded,
  }
}
