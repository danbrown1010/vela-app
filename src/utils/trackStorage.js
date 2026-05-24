import { openDB } from 'idb'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '../lib/supabase'
import { syncTrackToSupabase, deleteTrackFromSupabase } from './syncManager'

const DB_NAME = 'vela-tracks'
const DB_VERSION = 2

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

function emitSyncChanged() {
  window.dispatchEvent(new CustomEvent('vela:sync-changed'))
}

export async function getTracksDB() {
  return openDB(DB_NAME, DB_VERSION, {
    async upgrade(db, oldVersion, _newVersion, tx) {
      if (!db.objectStoreNames.contains('tracks')) {
        const store = db.createObjectStore('tracks', { keyPath: 'id' })
        store.createIndex('trip_id', 'trip_id')
        store.createIndex('user_id', 'user_id')
      }
      if (oldVersion < 2) {
        const store = tx.objectStore('tracks')
        let cursor = await store.openCursor()
        while (cursor) {
          await cursor.update({ ...cursor.value, pending_sync: false })
          cursor = await cursor.continue()
        }
      }
    },
  })
}

export async function saveTrack(track) {
  const trackWithId = { ...track, id: track.id ?? uuidv4() }
  const db = await getTracksDB()
  await db.put('tracks', { ...trackWithId, pending_sync: true })
  emitSyncChanged()

  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) {
    const { error } = await syncTrackToSupabase(trackWithId, session.user.id)
    if (error) {
      addPendingTrackSave(trackWithId)
    } else {
      removePendingTrackSave(trackWithId.id)
      await db.put('tracks', { ...trackWithId, pending_sync: false })
      emitSyncChanged()
    }
  }

  return trackWithId
}

export async function getTracks() {
  const db = await getTracksDB()
  return db.getAll('tracks')
}

export async function getTracksByTrip(tripId) {
  const db = await getTracksDB()
  return db.getAllFromIndex('tracks', 'trip_id', tripId)
}

export async function getTrack(id) {
  const db = await getTracksDB()
  return db.get('tracks', id)
}

export async function deleteTrack(id) {
  const db = await getTracksDB()
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
  emitSyncChanged()
}

export async function clearTracksPendingSync() {
  const db = await getTracksDB()
  const tx = db.transaction('tracks', 'readwrite')
  let cursor = await tx.store.openCursor()
  while (cursor) {
    if (cursor.value.pending_sync) {
      await cursor.update({ ...cursor.value, pending_sync: false })
    }
    cursor = await cursor.continue()
  }
  await tx.done
  emitSyncChanged()
}
