import { openDB } from 'idb'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '../lib/supabase'
import { syncTrackToSupabase, deleteTrackFromSupabase } from './syncManager'

const DB_NAME = 'vela-tracks'
const DB_VERSION = 1

const PENDING_SAVES_KEY   = 'vela-pending-track-saves'
const PENDING_DELETES_KEY = 'vela-pending-track-deletes'

// ── Pending queue helpers ────────────────────────────────────────────────────

export function getPendingTrackSaves() {
  const raw = localStorage.getItem(PENDING_SAVES_KEY)
  return raw ? JSON.parse(raw) : {}
}

export function addPendingTrackSave(track) {
  const pending = getPendingTrackSaves()
  pending[track.id] = track
  localStorage.setItem(PENDING_SAVES_KEY, JSON.stringify(pending))
}

export function removePendingTrackSave(id) {
  const pending = getPendingTrackSaves()
  delete pending[id]
  localStorage.setItem(PENDING_SAVES_KEY, JSON.stringify(pending))
}

export function getPendingTrackDeletes() {
  const raw = localStorage.getItem(PENDING_DELETES_KEY)
  return raw ? JSON.parse(raw) : []
}

export function addPendingTrackDelete(id) {
  const pending = getPendingTrackDeletes()
  if (!pending.includes(id)) {
    pending.push(id)
    localStorage.setItem(PENDING_DELETES_KEY, JSON.stringify(pending))
  }
}

export function removePendingTrackDelete(id) {
  const pending = getPendingTrackDeletes().filter(p => p !== id)
  localStorage.setItem(PENDING_DELETES_KEY, JSON.stringify(pending))
}

// ── IndexedDB ────────────────────────────────────────────────────────────────

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('tracks')) {
        const store = db.createObjectStore('tracks', { keyPath: 'id' })
        store.createIndex('trip_id',  'trip_id')
        store.createIndex('user_id',  'user_id')
      }
    },
  })
}

export async function saveTrack(track) {
  const trackWithId = { ...track, id: track.id ?? uuidv4() }
  const db = await getDB()
  await db.put('tracks', trackWithId)

  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) {
    const { error } = await syncTrackToSupabase(trackWithId, session.user.id)
    if (error) {
      addPendingTrackSave(trackWithId)
    } else {
      removePendingTrackSave(trackWithId.id)
    }
  }

  return trackWithId
}

export async function getTracks() {
  const db = await getDB()
  return db.getAll('tracks')
}

export async function getTracksByTrip(tripId) {
  const db = await getDB()
  return db.getAllFromIndex('tracks', 'trip_id', tripId)
}

export async function getTrack(id) {
  const db = await getDB()
  return db.get('tracks', id)
}

export async function deleteTrack(id) {
  const db = await getDB()
  await db.delete('tracks', id)

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const { error } = await deleteTrackFromSupabase(id)
      if (error) {
        addPendingTrackDelete(id)
      } else {
        removePendingTrackDelete(id)
      }
    }
  } catch (err) {
    console.error('deleteTrack sync error, queuing:', err)
    addPendingTrackDelete(id)
  }
}
