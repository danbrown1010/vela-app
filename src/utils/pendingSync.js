import { getGearDB } from './gearStorage'
import { getTracksDB } from './trackStorage'
import { getPendingDeletes, getPendingSaves } from './gearStorage'
import { getPendingTrackDeletes, getPendingTrackSaves } from './trackStorage'
import { getPendingTripSaves, getPendingTripDeletes } from './tripStorage'

const LAST_SYNC_KEY = 'vela-last-sync-time'

export function getLastSyncTime() {
  const raw = localStorage.getItem(LAST_SYNC_KEY)
  return raw ? new Date(raw) : null
}

export function setLastSyncTime() {
  localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString())
}

export function emitSyncChanged() {
  window.dispatchEvent(new CustomEvent('vela:sync-changed'))
}

export function subscribeToCount(callback) {
  const handler = () => callback()
  window.addEventListener('vela:sync-changed', handler)
  return () => window.removeEventListener('vela:sync-changed', handler)
}

export async function countPending() {
  let count = 0

  try {
    const gearDB = await getGearDB()
    const gearItems = await gearDB.getAll('gear')
    count += gearItems.filter(item => item.pending_sync).length
  } catch { /* IDB unavailable */ }

  try {
    const tracksDB = await getTracksDB()
    const tracks = await tracksDB.getAll('tracks')
    count += tracks.filter(t => t.pending_sync).length
  } catch { /* IDB unavailable */ }

  count += getPendingDeletes().length
  count += getPendingTrackDeletes().length
  count += Object.keys(getPendingTripSaves()).length
  count += getPendingTripDeletes().length

  return count
}

export async function listPending() {
  const items = []

  try {
    const gearDB = await getGearDB()
    const gearItems = await gearDB.getAll('gear')
    for (const item of gearItems) {
      if (item.pending_sync) items.push({ type: 'gear', label: item.name ?? item.id, id: item.id })
    }
  } catch { /* IDB unavailable */ }

  for (const id of getPendingDeletes()) {
    items.push({ type: 'gear-delete', label: `Gear delete (${id.slice(0, 8)}…)`, id })
  }

  try {
    const tracksDB = await getTracksDB()
    const tracks = await tracksDB.getAll('tracks')
    for (const t of tracks) {
      if (t.pending_sync) items.push({ type: 'track', label: t.name ?? t.id, id: t.id })
    }
  } catch { /* IDB unavailable */ }

  for (const id of getPendingTrackDeletes()) {
    items.push({ type: 'track-delete', label: `Track delete (${id.slice(0, 8)}…)`, id })
  }

  const tripSaves = getPendingTripSaves()
  for (const trip of Object.values(tripSaves)) {
    items.push({ type: 'trip', label: trip.name ?? trip.id, id: trip.id })
  }

  for (const id of getPendingTripDeletes()) {
    items.push({ type: 'trip-delete', label: `Trip delete (${id.slice(0, 8)}…)`, id })
  }

  return items
}
