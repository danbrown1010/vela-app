// Backward-compat shim — import from systemStatus directly
export {
  SystemStatusProvider as RigStatusProvider,
  useSystemStatus      as useRigStatus,
  useSetSystemStatus   as useSetRigStatus,
} from './systemStatus'
