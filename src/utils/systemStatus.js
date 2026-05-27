// Maps SystemStatusContext 'env' value (4 states) → COS indicator state (3 states).
export function envToCosState(envStatus) {
  if (envStatus === 'connected')   return 'connected'
  if (envStatus === 'loading')     return 'searching'
  return 'off'  // 'offline' | 'unconfigured'
}
