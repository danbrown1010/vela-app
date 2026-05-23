import { useState, useEffect, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '../lib/supabase'
import { saveTrack, getTracks, getTracksByTrip, deleteTrack } from '../utils/trackStorage'
import { fetchTracksFromSupabase } from '../utils/syncManager'

export function useTracks(userId, tripId = null) {
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  // Load from Supabase on mount, fall back to IDB if offline
  useEffect(() => {
    if (!userId) { setLoading(false); return }
    let cancelled = false

    async function load() {
      try {
        const remote = await fetchTracksFromSupabase(userId)
        if (cancelled) return
        if (remote.length > 0) {
          const filtered = tripId ? remote.filter(t => t.trip_id === tripId) : remote
          setTracks(filtered)
        } else {
          // Offline fallback
          const local = tripId ? await getTracksByTrip(tripId) : await getTracks()
          if (!cancelled) setTracks(local)
        }
      } catch (err) {
        if (cancelled) return
        setError(err)
        const local = tripId ? await getTracksByTrip(tripId) : await getTracks()
        if (!cancelled) setTracks(local)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [userId, tripId])

  const importTrack = useCallback(async ({
    file,
    name,
    tripIdOverride,
    geojson,
    pointCount,
    distanceM,
    bboxArr,
    sourceFormat,
    simplified = false,
    simplificationTolerance = null,
  }) => {
    try {
      const id = uuidv4()
      const now = new Date().toISOString()

      // 1. IDB + Supabase first — track is usable even if the file upload fails
      const track = {
        id,
        user_id:                  userId,
        trip_id:                  tripIdOverride ?? null,
        name,
        source_format:            sourceFormat,
        source_file_path:         null,
        geojson,
        point_count:              pointCount,
        simplified,
        simplification_tolerance: simplificationTolerance,
        distance_m:               distanceM,
        bbox:                     bboxArr,
        created_at:               now,
        updated_at:               now,
      }

      const saved = await saveTrack(track)
      setTracks(prev => [saved, ...prev])

      // 2. Storage upload — best-effort, 30 s timeout, does not block return
      if (file && userId) {
        const storagePath = `${userId}/${id}/${file.name}`
        const uploadTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Storage upload timed out after 30s')), 30000)
        )
        try {
          const { error: uploadError } = await Promise.race([
            supabase.storage
              .from('track-files')
              .upload(storagePath, file, { contentType: file.type || 'application/octet-stream' }),
            uploadTimeout,
          ])
          if (uploadError) throw new Error(uploadError.message)
          // Patch source_file_path now that we have the storage reference
          const patched = { ...saved, source_file_path: storagePath, updated_at: new Date().toISOString() }
          saveTrack(patched).catch(e => console.warn('[importTrack] source_file_path patch failed:', e))
          setTracks(prev => prev.map(t => t.id === id ? { ...t, source_file_path: storagePath } : t))
        } catch (uploadErr) {
          console.warn('[importTrack] file upload failed, track saved without file reference:', uploadErr.message)
        }
      }

      return saved
    } catch (err) {
      throw new Error(`Track import failed: ${err.message}`)
    }
  }, [userId])

  const removeTrack = useCallback(async (trackId) => {
    await deleteTrack(trackId)
    setTracks(prev => prev.filter(t => t.id !== trackId))
  }, [])

  return { tracks, loading, error, importTrack, removeTrack }
}
