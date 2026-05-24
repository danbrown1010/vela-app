import { useState, createContext, useContext, useCallback } from 'react'

const RigStatusContext = createContext(null)

export function RigStatusProvider({ children }) {
  const [status, setStatus] = useState({
    power: 'loading',
    comms: 'loading',
    env:   'loading',
  })

  const setSection = useCallback((section, val) => {
    setStatus(prev => prev[section] === val ? prev : { ...prev, [section]: val })
  }, [])

  return (
    <RigStatusContext.Provider value={{ status, setSection }}>
      {children}
    </RigStatusContext.Provider>
  )
}

export function useRigStatus() {
  return useContext(RigStatusContext).status
}

export function useSetRigStatus() {
  return useContext(RigStatusContext).setSection
}
