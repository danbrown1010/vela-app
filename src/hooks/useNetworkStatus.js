import { useEffect, useState } from 'react'
import { useAppStore } from '../store/index'

const STALE_MS = 20 * 60 * 1000  // 20 min

// NET state is proxied through NWS weather freshness — if NWS is unreachable,
// NET shows 'searching'. A global NWS outage would produce a false 'searching'
// even when the device has internet; acceptable trade-off vs. complexity of
// aggregating multiple endpoints.
export function useNetworkStatus() {
  const { weatherUpdatedAt } = useAppStore()
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const up   = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online',  up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online',  up)
      window.removeEventListener('offline', down)
    }
  }, [])

  const lastFetch = weatherUpdatedAt ? new Date(weatherUpdatedAt) : null
  const fresh     = lastFetch && (Date.now() - lastFetch.getTime() < STALE_MS)

  const state =
    !online ? 'off'      :
    !fresh  ? 'searching' :
              'connected'

  return { online, lastFetch, state }
}
