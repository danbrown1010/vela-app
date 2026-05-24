import { useState, useEffect, useCallback } from 'react'
import { countPending, subscribeToCount } from '../utils/pendingSync'

export function usePendingSyncCount() {
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    const n = await countPending()
    setCount(n)
  }, [])

  useEffect(() => {
    refresh()
    const unsub = subscribeToCount(refresh)
    return unsub
  }, [refresh])

  return count
}
