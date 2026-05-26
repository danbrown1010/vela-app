import { useState, useEffect, useMemo, createContext, useContext, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useGpsSource } from '../hooks/useGpsSource'
import { useWeather } from '../hooks/useWeather'
import { useAirQuality } from '../hooks/useAirQuality'
import { useEcoFlow } from '../hooks/useEcoFlow'
import { useSafety } from '../hooks/useSafety'
import { deriveThreats } from '../utils/deriveThreats'
import { ECOFLOW_DEVICES } from '../config/devices'
import { supabase } from '../lib/supabase'
import { syncTripToSupabase, fetchTripsFromSupabase, deleteTripFromSupabase } from '../utils/syncManager'
import { addPendingTripSave, removePendingTripSave, addPendingTripDelete, removePendingTripDelete } from '../utils/tripStorage'

const AppContext = createContext(null)

export function AppProvider({ children, user = null, profile = null, signOut = () => {}, signInWithGoogle = () => {} }) {
  const [profileState, setProfile] = useState(profile)
  useEffect(() => { if (profile !== undefined) setProfile(profile) }, [profile])
  const isPro = profileState?.plan === 'pro'

  const [flags, setFlags] = useState({})
  useEffect(() => {
    if (!user) return
    supabase
      .from('feature_flags')
      .select('id, enabled')
      .then(({ data }) => {
        if (data) setFlags(Object.fromEntries(data.map(r => [r.id, r.enabled])))
      })
  }, [user?.id])

  const [trips, setTrips]         = useState([])
  const [activeTrip, setActiveTrip] = useState(null)
  const [syncStatus, setSyncStatus] = useState('idle')
  const [accent, setAccentState]  = useState(() => localStorage.getItem('vela-accent') || '#f97316')
  const [theme, setThemeState]    = useState(() => {
    const stored = localStorage.getItem('vela-theme')
    if (!stored) localStorage.setItem('vela-theme', 'evergreen')
    return stored || 'evergreen'
  })
  const [dataBust, setDataBust]   = useState(0)

  // Load trips from Supabase on sign-in
  useEffect(() => {
    if (!user) return
    fetchTripsFromSupabase(user.id).then(remoteTrips => {
      const real = remoteTrips.map(t => ({
        id: t.id,
        name: t.name,
        type: t.type,
        region: t.region,
        departureDate: t.departure_date,
        returnDate: t.return_date,
        status: t.status,
        is_published: t.is_published ?? false,
        waypoints: t.waypoints ?? [],
        campsites: t.campsites ?? [],
        ...(t.data ?? {}),
      }))
      setTrips(real)
    }).catch(console.error)
  }, [user?.id])

  const createTrip = useCallback(async (trip) => {
    const next = {
      ...trip,
      id: uuidv4(),
      status: trip.status ?? 'pre-trip',
      createdAt: new Date().toISOString(),
    }
    setTrips(prev => [...prev, next])
    setActiveTrip(next)

    // Sync in background — don't block the UI or throw
    if (user) {
      syncTripToSupabase(next, user.id)
        .then(({ error }) => {
          if (error) {
            console.warn('[createTrip] sync failed, queuing pending save:', error)
            addPendingTripSave(next)
          } else {
            removePendingTripSave(next.id)
          }
        })
        .catch((err) => {
          console.error('[createTrip] sync threw:', err)
          addPendingTripSave(next)
        })
    } else {
      console.warn('[createTrip] no user — trip NOT synced to Supabase')
    }

    return next
  }, [user])

  const updateTrip = useCallback(async (trip) => {
    setTrips(prev => prev.map(t => t.id === trip.id ? trip : t))
    setActiveTrip(prev => prev?.id === trip.id ? trip : prev)

    if (user) {
      const { error } = await syncTripToSupabase(trip, user.id)
      if (error) {
        addPendingTripSave(trip)
      } else {
        removePendingTripSave(trip.id)
      }
    }
  }, [user])

  const deleteTrip = useCallback(async (tripId) => {
    setTrips(prev => prev.filter(t => t.id !== tripId))
    setActiveTrip(prev => prev?.id === tripId ? null : prev)

    if (user) {
      try {
        const { error } = await deleteTripFromSupabase(tripId)
        if (error) {
          addPendingTripDelete(tripId)
        } else {
          removePendingTripDelete(tripId)
        }
      } catch (err) {
        console.error('deleteTrip sync error, queuing:', err)
        addPendingTripDelete(tripId)
      }
    }
  }, [user])

  const setActiveTripById = useCallback(async (tripId) => {
    const trip = trips.find(t => t.id === tripId)
    if (!trip) return

    if (activeTrip && activeTrip.id !== tripId) {
      setTrips(prev => prev.map(t => t.id === activeTrip.id ? { ...t, status: 'planning' } : t))
      if (user?.id) {
        await supabase.from('trips').update({ status: 'planning' }).eq('id', activeTrip.id).eq('user_id', user.id)
      }
    }

    const updatedTrip = { ...trip, status: 'pre-trip' }
    setActiveTrip(updatedTrip)
    setTrips(prev => prev.map(t => t.id === tripId ? updatedTrip : t))

    if (user?.id) {
      await supabase.from('trips')
        .update({ status: 'pre-trip', updated_at: new Date().toISOString() })
        .eq('id', tripId)
        .eq('user_id', user.id)
    }
  }, [trips, activeTrip, user])

  const deactivateTrip = useCallback(async () => {
    if (!activeTrip) return
    const updatedTrip = { ...activeTrip, status: 'planning' }
    setTrips(prev => prev.map(t => t.id === activeTrip.id ? updatedTrip : t))
    setActiveTrip(null)
    if (user?.id) {
      await supabase.from('trips')
        .update({ status: 'planning', updated_at: new Date().toISOString() })
        .eq('id', activeTrip.id)
        .eq('user_id', user.id)
    }
  }, [activeTrip, user])

  const publishTrip = useCallback(async (tripId) => {
    await supabase
      .from('trips')
      .update({ is_published: false, unpublished_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('is_published', true)

    const { error } = await supabase
      .from('trips')
      .update({ is_published: true, published_at: new Date().toISOString() })
      .eq('id', tripId)
      .eq('user_id', user.id)

    if (!error) {
      setTrips(prev => prev.map(t => ({ ...t, is_published: t.id === tripId })))
      setActiveTrip(prev => prev ? { ...prev, is_published: prev.id === tripId } : prev)
    }
  }, [user])

  const unpublishTrip = useCallback(async (tripId) => {
    const { error } = await supabase
      .from('trips')
      .update({ is_published: false, unpublished_at: new Date().toISOString() })
      .eq('id', tripId)
      .eq('user_id', user.id)

    // Delete position row — signals the watch page via realtime DELETE event
    await supabase.from('trip_positions').delete().eq('trip_id', tripId)

    if (!error) {
      setTrips(prev => prev.map(t => t.id === tripId ? { ...t, is_published: false } : t))
      setActiveTrip(prev => prev?.id === tripId ? { ...prev, is_published: false } : prev)
    }
  }, [user])

  const refreshHomeData = useCallback(() => setDataBust(k => k + 1), [])

  const [pendingInviteCount, setPendingInviteCount] = useState(0)
  useEffect(() => {
    if (!user) { setPendingInviteCount(0); return }
    supabase
      .from('crew_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .then(({ count }) => setPendingInviteCount(count ?? 0))
  }, [user?.id])

  const [petsEnabled, setPetsEnabledState] = useState(() => localStorage.getItem('vela-pets-enabled') === 'true')
  const setPetsEnabled = useCallback((v) => {
    setPetsEnabledState(v)
    localStorage.setItem('vela-pets-enabled', v ? 'true' : 'false')
  }, [])

  const [tripLabels, setTripLabelsState] = useState(() => localStorage.getItem('vela-trip-labels') !== 'false')
  const setTripLabels = useCallback((v) => {
    setTripLabelsState(v)
    localStorage.setItem('vela-trip-labels', v ? 'true' : 'false')
  }, [])

  const gpsResult = useGpsSource()
  const location = useMemo(() =>
    gpsResult.source === null ? null : {
      lat:      gpsResult.lat,
      lng:      gpsResult.lng,
      accuracy: gpsResult.accuracy,   // METERS — unchanged for all consumers
      altitude: gpsResult.altitude,
      timestamp: gpsResult.timestamp,
      heading:  gpsResult.heading,
      speed:    gpsResult.speed,
    }
  , [gpsResult])
  const gpsStatus =
    gpsResult.source !== null && (gpsResult.accuracy ?? Infinity) < 100
      ? 'locked'
      : gpsResult.browserError === 'denied'
      ? 'denied'
      : gpsResult.browserError === 'unavailable' && !gpsResult.obdOnline
      ? 'unavailable'
      : 'requesting'
  const { data: ecoflowData } = useEcoFlow(ECOFLOW_DEVICES.delta2Max.sn)
  const ecoflowSoc      = ecoflowData?.soc ?? null
  const ecoflowCharging = ecoflowData != null ? (ecoflowData.totalInputWatts ?? 0) > 0 : null
  const wx = useWeather(location?.lat, location?.lng)
  const { aqi, loading: aqiLoading, error: aqiError } = useAirQuality(location?.lat, location?.lng, dataBust)
  const safety = useSafety(location?.lat, location?.lng)
  const threats = useMemo(
    () => deriveThreats({ weather: wx, safety, position: location, activeTrip }),
    [wx, safety, location, activeTrip]
  )

  const setAccent = useCallback((color) => {
    setAccentState(color)
    localStorage.setItem('vela-accent', color)
    document.documentElement.style.setProperty('--color-accent', color)
  }, [])

  const setTheme = useCallback((t) => {
    setThemeState(t)
    localStorage.setItem('vela-theme', t)
    document.documentElement.classList.remove('evergreen', 'parchment')
    document.documentElement.classList.add(t)
  }, [])

  return (
    <AppContext.Provider value={{
      user, profile: profileState, isPro, setProfile, signOut, signInWithGoogle, flags,
      syncStatus, setSyncStatus,
      trips, activeTrip, setActiveTrip, createTrip, updateTrip, deleteTrip, setActiveTripById, deactivateTrip, publishTrip, unpublishTrip,
      accent, setAccent, theme, setTheme,
      pendingInviteCount, setPendingInviteCount,
      petsEnabled, setPetsEnabled,
      tripLabels, setTripLabels,
      location, gpsStatus,
      gpsSource: gpsResult.source,
      gpsUpdatedAt: gpsResult.updatedAt,
      obdOnline: gpsResult.obdOnline,
      ecoflowSoc, ecoflowCharging,
      weather: wx.current, weatherForecast: wx.daily, weatherLoading: wx.loading, weatherError: wx.error,
      weatherHourly: wx.hourly, weatherAlerts: wx.alerts, weatherUpdatedAt: wx.updatedAt,
      aqi, aqiLoading, aqiError,
      safety, threats,
      refreshHomeData,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppStore() {
  return useContext(AppContext)
}
