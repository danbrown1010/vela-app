import { useState, useEffect, useCallback } from 'react'

const NIFC_URL =
  'https://services3.arcgis.com/T4QMspbfLg3qoC1P/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query?where=1%3D1&outFields=IncidentName,GISAcres,DailyAcres,PercentContained,CreateDate&outSR=4326&f=geojson'

export function useFireData() {
  const [fires, setFires] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [bustKey, setBustKey] = useState(0)

  useEffect(() => {
    const cached = localStorage.getItem('vela-fire-data')
    const cachedTime = localStorage.getItem('vela-fire-time')

    if (bustKey === 0 && cached && cachedTime) {
      const age = Date.now() - parseInt(cachedTime)
      if (age < 3600000) {
        setFires(JSON.parse(cached))
        setLastUpdated(new Date(parseInt(cachedTime)))
        setLoading(false)
        return
      }
    }

    setLoading(true)
    fetch(NIFC_URL)
      .then(r => r.json())
      .then(data => {
        setFires(data)
        setLastUpdated(new Date())
        localStorage.setItem('vela-fire-data', JSON.stringify(data))
        localStorage.setItem('vela-fire-time', Date.now().toString())
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
        if (cached) setFires(JSON.parse(cached))
      })
  }, [bustKey])

  const refetch = useCallback(() => setBustKey(k => k + 1), [])

  return { fires, loading, error, lastUpdated, refetch }
}
