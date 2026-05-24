import { useEffect } from 'react'
import { useHomeAssistant } from '../hooks/useHomeAssistant'
import { useCommunications } from '../hooks/useCommunications'
import { useSetRigStatus } from '../store/rigStatus'

// Must match the freshness constants in HomeAssistantCard and CommunicationsSection.
const HA_FRESHNESS_MS = 45000
const COMMS_FRESHNESS_MS = 45000

// Mounts at app root so both pills reflect real HA status from boot,
// regardless of whether the user has navigated to RigPage yet.
// Runs both hooks in parallel with the instances inside the section
// components (acceptable double-fetch on a local LAN).
export function HaProbeRunner() {
  const ha = useHomeAssistant()
  const comms = useCommunications()
  const setRigStatus = useSetRigStatus()

  const configured = !!ha.token && !!ha.HA_URL
  const haAge = ha.lastUpdated ? Date.now() - ha.lastUpdated.getTime() : Infinity
  const envStatus =
    ha.haStatus === 'loading'   ? 'loading'
    : !configured               ? 'unconfigured'
    : (ha.lastError || !ha.connected) ? 'offline'
    : ha.lastUpdated && haAge < HA_FRESHNESS_MS ? 'connected'
    : 'offline'

  useEffect(() => {
    setRigStatus('env', envStatus)
  }, [envStatus, setRigStatus])

  const commsAge = comms.lastUpdated ? Date.now() - comms.lastUpdated.getTime() : Infinity
  const commsStatus =
    comms.haStatus === 'loading'  ? 'loading'
    : !comms.isConfigured         ? 'unconfigured'
    : comms.error && comms.error !== 'Home Assistant not configured' ? 'offline'
    : !comms.error && commsAge < COMMS_FRESHNESS_MS ? 'connected'
    : 'offline'

  useEffect(() => {
    setRigStatus('comms', commsStatus)
  }, [commsStatus, setRigStatus])

  return null
}
