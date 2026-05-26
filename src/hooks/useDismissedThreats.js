import { useState, useCallback } from 'react'

const SESSION_KEY = 'vela:dismissed-threats'

function loadIds() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { /* sessionStorage unavailable — ignore */
    return new Set()
  }
}

function saveIds(ids) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify([...ids]))
  } catch { /* sessionStorage unavailable — ignore */ }
}

export function useDismissedThreats() {
  const [dismissedIds, setDismissedIds] = useState(() => loadIds())

  const dismiss = useCallback((id) => {
    setDismissedIds(prev => {
      const next = new Set(prev)
      next.add(id)
      saveIds(next)
      return next
    })
  }, [])

  const clearDismissed = useCallback(() => {
    try { sessionStorage.removeItem(SESSION_KEY) } catch { /* sessionStorage unavailable — ignore */ }
    setDismissedIds(new Set())
  }, [])

  const isDismissed = useCallback((id) => dismissedIds.has(id), [dismissedIds])

  return { dismissedIds, dismiss, clearDismissed, isDismissed }
}
