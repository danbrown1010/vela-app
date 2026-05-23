import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useIsTester(userId) {
  const [isTester, setIsTester] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setIsTester(false)
      setLoading(false)
      return
    }
    supabase.rpc('is_tester', { uid: userId })
      .then(({ data, error }) => {
        setIsTester(!error && !!data)
        setLoading(false)
      })
      .catch(() => {
        setIsTester(false)
        setLoading(false)
      })
  }, [userId])

  return { isTester, loading }
}
