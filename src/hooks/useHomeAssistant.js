import { useState, useEffect, useCallback } from 'react'
import { useHaToken } from '../store/haTokenStore'
import { isOnWifi, onNetworkChange } from '../utils/networkType'

export function useHomeAssistant() {
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(true)
  const [entities, setEntities] = useState({})
  const [lastUpdated, setLastUpdated] = useState(null)
  const [lastError, setLastError] = useState(null)
  const { plaintextToken, haUrl, status: haStatus, requestUnlock } = useHaToken()
  const token = plaintextToken ?? ''
  // Fallback chain: DB-stored URL → env var → hardcoded local IP
  const HA_URL = haUrl || import.meta.env.VITE_HA_URL || 'http://192.168.68.112:8123'

  useEffect(() => {
    if (haStatus === 'locked') requestUnlock()
  }, [haStatus, requestUnlock])

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  const loadEntities = useCallback(async () => {
    const entityIds = [
      'sensor.ursa_minor_temperature',
      'sensor.ursa_minor_humidity',
      'sensor.cabin_temperature',
      'sensor.cabin_humidity',
      'sensor.outside_temperature',
      'sensor.outside_humidity',
      'sensor.refrigerator_temperature',
      'sensor.refrigerator_humidity',
      'sensor.chomp_weather_station_inside_temperature',
      'sensor.chomp_weather_station_inside_humidity',
      'sensor.chomp_weather_station_outside_temperature',
      'sensor.chomp_weather_station_outside_pressure',
      'light.white_rock_lights',
      'light.light_blue_rock_lights',
      'light.pink_rock_lights',
      'light.yellow_rock_light',
      'light.rock_lights_red_light_switch',
      'light.rock_lights_green_light_switch',
      'light.rock_lights_blue_light_switch',
      'light.rock_lights_white_light_switch',
      'light.rock_lights_pink_light_switch',
      'sensor.chomp_battery_battery_level',
      'sensor.chomp_battery_ac_in_power',
      'sensor.chomp_battery_ac_out_power',
      'sensor.chomp_battery_dc_out_power',
      'sensor.chomp_battery_solar_1_in_power',
      'sensor.chomp_battery_status',
      'sensor.chomp_battery_charge_remaining_time',
      'sensor.chomp_battery_discharge_remaining_time',
      'switch.chomp_battery_ac_enabled',
      'switch.chomp_battery_dc_12v_enabled',
      'switch.chomp_battery_usb_enabled',
      'switch.chomp_battery_beeper',
      'sensor.cabin_battery',
      'sensor.outside_battery',
      'sensor.ursa_minor_battery',
      'sensor.refrigerator_battery',
      'binary_sensor.cabin_power',
      'binary_sensor.outside_power',
      'binary_sensor.ursa_minor_power',
      'binary_sensor.refrigerator_power',
      'binary_sensor.starlink_connectivity',
      'sensor.starlink_ping',
      'sensor.starlink_downlink_throughput',
      'sensor.starlink_uplink_throughput',
      'switch.starlink_stowed',
      'media_player.chomp_stereo',
      'media_player.spotify_dan_brown',
      'sensor.system_monitor_processor_temperature',
      'sensor.system_monitor_disk_free',
      'sensor.system_monitor_disk_use_percent',
    ]

    try {
      const res = await fetch(`${HA_URL}/api/states`, {
        headers,
        signal: AbortSignal.timeout(8000),
      })
      const allStates = await res.json()

      const filtered = {}
      allStates
        .filter(e => entityIds.includes(e.entity_id))
        .forEach(e => { filtered[e.entity_id] = e })

      setEntities(filtered)
      setLastUpdated(new Date())
      setLastError(null)
    } catch (err) {
      console.error('HA entity load error:', err)
      setLastError(err.message || 'Entity load failed')
    }
  }, [token])

  const connect = useCallback(async () => {
    if (!token) {
      setConnecting(false)
      setConnected(false)
      return
    }

    setConnecting(true)
    try {
      const res = await fetch(`${HA_URL}/api/`, {
        headers,
        signal: AbortSignal.timeout(5000),
      })

      if (!res.ok) {
        setConnected(false)
        setConnecting(false)
        return
      }

      setConnected(true)
      await loadEntities()
    } catch (err) {
      console.warn('HA connection failed:', err.message)
      setConnected(false)
    } finally {
      setConnecting(false)
    }
  }, [token, loadEntities])

  const callService = useCallback(async (domain, service, entityId, data = {}) => {
    try {
      const res = await fetch(`${HA_URL}/api/services/${domain}/${service}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ entity_id: entityId, ...data }),
      })
      if (res.ok) await loadEntities()
    } catch (err) {
      console.error('HA service call error:', err)
    }
  }, [token, loadEntities])

  const toggle = (entityId) => {
    const domain = entityId.split('.')[0]
    return callService(domain, 'toggle', entityId)
  }

  const turnOn = (entityId, data = {}) => {
    const domain = entityId.split('.')[0]
    return callService(domain, 'turn_on', entityId, data)
  }

  const turnOff = (entityId) => {
    const domain = entityId.split('.')[0]
    return callService(domain, 'turn_off', entityId)
  }

  const getState = (entityId) => entities[entityId]?.state ?? null

  const getAttr = (entityId, attr) => entities[entityId]?.attributes?.[attr] ?? null

  const isOn = (entityId) => {
    const state = getState(entityId)
    return state === 'on' || state === 'playing' || state === 'home'
  }

  useEffect(() => {
    if (!token) return

    if (isOnWifi()) {
      connect()
    } else {
      setConnecting(false)
    }

    // Lightweight ping every 10s — only updates connected flag, no entity fetch.
    const keepAlive = setInterval(async () => {
      if (document.visibilityState !== 'visible' || !isOnWifi()) return
      try {
        await fetch(`${HA_URL}/api/`, {
          headers,
          signal: AbortSignal.timeout(3000),
        })
      } catch (err) {
        setConnected(false)
        setLastError(err.message || 'Connection lost')
      }
    }, 10000)

    // Full entity refresh every 30s (heavier fetch, Wi-Fi only).
    const refresh = setInterval(() => {
      if (document.visibilityState !== 'visible' || !isOnWifi()) return
      loadEntities()
    }, 30000)

    const handleResume = () => {
      if (!isOnWifi()) {
        setConnected(false)
        setConnecting(false)
        return
      }
      if (document.visibilityState === 'visible') connect()
    }
    document.addEventListener('visibilitychange', handleResume)
    const removeNetListener = onNetworkChange(handleResume)

    return () => {
      clearInterval(keepAlive)
      clearInterval(refresh)
      document.removeEventListener('visibilitychange', handleResume)
      removeNetListener()
    }
  }, [token])

  return {
    connected,
    connecting,
    entities,
    token,
    haStatus,
    connect,
    callService,
    toggle,
    turnOn,
    turnOff,
    getState,
    getAttr,
    isOn,
    lastUpdated,
    lastError,
    reload: loadEntities,
    HA_URL,
  }
}
