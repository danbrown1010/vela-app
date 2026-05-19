import { useState, useEffect } from 'react'
import { ECOFLOW_DEVICES } from '../config/devices'
import { getIntegration, saveIntegration } from '../utils/integrations'

const INTEGRATION = 'ecoflow'

const ALL_DEVICE_IDS = Object.keys(ECOFLOW_DEVICES)

const DEFAULTS = {
  visibleDeviceIds: ALL_DEVICE_IDS, // default: show all
}

/**
 * Hook for managing which EcoFlow devices are visible on the Power section.
 * Reads from Supabase (cached in localStorage), exposes a setter that persists.
 */
export function useEcoflowConfig(userId) {
  const [visibleDeviceIds, setVisibleDeviceIds] = useState(ALL_DEVICE_IDS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    getIntegration(INTEGRATION, DEFAULTS).then((cfg) => {
      if (cancelled) return
      // Validate: drop any IDs that no longer exist in ECOFLOW_DEVICES
      const valid = (cfg.visibleDeviceIds ?? ALL_DEVICE_IDS).filter((id) =>
        ALL_DEVICE_IDS.includes(id)
      )
      setVisibleDeviceIds(valid.length ? valid : ALL_DEVICE_IDS)
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [])

  const setVisible = async (nextIds) => {
    // Preserve original device order regardless of toggle sequence
    const ordered = ALL_DEVICE_IDS.filter((id) => nextIds.includes(id))
    setVisibleDeviceIds(ordered)
    await saveIntegration(INTEGRATION, { visibleDeviceIds: ordered }, userId)
  }

  const toggle = async (deviceId) => {
    const next = visibleDeviceIds.includes(deviceId)
      ? visibleDeviceIds.filter((id) => id !== deviceId)
      : [...visibleDeviceIds, deviceId]
    await setVisible(next)
  }

  return {
    visibleDeviceIds,
    visibleDevices: visibleDeviceIds.map((id) => ({ id, ...ECOFLOW_DEVICES[id] })),
    allDevices: ALL_DEVICE_IDS.map((id) => ({ id, ...ECOFLOW_DEVICES[id] })),
    toggle,
    setVisible,
    loaded,
  }
}
