import { useState, createContext, useContext, useCallback } from 'react'

const SystemStatusContext = createContext(null)

export function SystemStatusProvider({ children }) {
  const [status, setStatus] = useState({
    power:  'loading',
    comms:  'loading',
    env:    'loading',
    engine: 'unconfigured',
  })

  const setSection = useCallback((section, val) => {
    setStatus(prev => prev[section] === val ? prev : { ...prev, [section]: val })
  }, [])

  return (
    <SystemStatusContext.Provider value={{ status, setSection }}>
      {children}
    </SystemStatusContext.Provider>
  )
}

// Optional key param: useSystemStatus('env') → string, useSystemStatus() → full object
export function useSystemStatus(key) {
  const { status } = useContext(SystemStatusContext)
  return key ? status[key] : status
}

export function useSetSystemStatus() {
  return useContext(SystemStatusContext).setSection
}
