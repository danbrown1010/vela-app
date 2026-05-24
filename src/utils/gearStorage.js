import { openDB } from 'idb'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '../lib/supabase'
import { syncGearToSupabase, deleteGearFromSupabase } from './syncManager'

function isValidUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

const PENDING_SAVES_KEY = 'vela-pending-saves'

export function getPendingSaves() {
  const raw = localStorage.getItem(PENDING_SAVES_KEY)
  return raw ? JSON.parse(raw) : {}
}

function addPendingSave(item) {
  const pending = getPendingSaves()
  pending[item.id] = item
  localStorage.setItem(PENDING_SAVES_KEY, JSON.stringify(pending))
}

export function removePendingSave(id) {
  const pending = getPendingSaves()
  delete pending[id]
  localStorage.setItem(PENDING_SAVES_KEY, JSON.stringify(pending))
}

export function clearPendingSaves() {
  localStorage.removeItem(PENDING_SAVES_KEY)
}

const PENDING_DELETES_KEY = 'vela-pending-deletes'

export function getPendingDeletes() {
  const raw = localStorage.getItem(PENDING_DELETES_KEY)
  return raw ? JSON.parse(raw) : []
}

function addPendingDelete(id) {
  const pending = getPendingDeletes()
  if (!pending.includes(id)) {
    pending.push(id)
    localStorage.setItem(PENDING_DELETES_KEY, JSON.stringify(pending))
  }
}

export function removePendingDelete(id) {
  const pending = getPendingDeletes().filter(p => p !== id)
  localStorage.setItem(PENDING_DELETES_KEY, JSON.stringify(pending))
}

const DB_NAME = 'vela-gear'
const DB_VERSION = 2

function emitSyncChanged() {
  window.dispatchEvent(new CustomEvent('vela:sync-changed'))
}

export async function getGearDB() {
  return openDB(DB_NAME, DB_VERSION, {
    async upgrade(db, oldVersion, _newVersion, tx) {
      if (!db.objectStoreNames.contains('gear')) {
        const store = db.createObjectStore('gear', { keyPath: 'id' })
        store.createIndex('category', 'category')
        store.createIndex('onRig', 'onRig')
      }
      if (oldVersion < 2) {
        const store = tx.objectStore('gear')
        let cursor = await store.openCursor()
        while (cursor) {
          await cursor.update({ ...cursor.value, pending_sync: false })
          cursor = await cursor.continue()
        }
      }
    },
  })
}

export async function saveGearItem(item) {
  const itemWithUUID = {
    ...item,
    id: isValidUUID(item.id) ? item.id : uuidv4(),
  }
  const db = await getGearDB()
  await db.put('gear', { ...itemWithUUID, pending_sync: true })
  emitSyncChanged()

  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) {
    const { error } = await syncGearToSupabase(itemWithUUID, session.user.id)
    if (error) {
      addPendingSave(itemWithUUID)
    } else {
      removePendingSave(itemWithUUID.id)
      await db.put('gear', { ...itemWithUUID, pending_sync: false })
      emitSyncChanged()
    }
  }
}

export async function getGearItems() {
  const db = await getGearDB()
  return db.getAll('gear')
}

export async function getGearByCategory(category) {
  const db = await getGearDB()
  const index = db.transaction('gear').store.index('category')
  return index.getAll(category)
}

export async function deleteGearItem(id) {
  const db = await getGearDB()
  await db.delete('gear', id)

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const { error } = await deleteGearFromSupabase(id)
      if (error) {
        addPendingDelete(id)
      } else {
        removePendingDelete(id)
      }
    }
  } catch (err) {
    console.error('deleteGearItem sync error, queuing:', err)
    addPendingDelete(id)
  }
  emitSyncChanged()
}

export async function clearGearPendingSync() {
  const db = await getGearDB()
  const tx = db.transaction('gear', 'readwrite')
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

export async function getGearSummary() {
  const items = await getGearItems()
  if (items.length === 0) return null

  const byCategory = {}
  items.forEach(item => {
    if (!byCategory[item.category]) byCategory[item.category] = []
    byCategory[item.category].push(item)
  })

  const lines = ['Equipment on Chomp (2014 JKU):']
  Object.entries(byCategory).forEach(([cat, catItems]) => {
    lines.push(`\n${cat}:`)
    catItems.forEach(item => {
      let line = `  - ${item.name}`
      if (item.vendor) line += ` (${item.vendor})`
      if (item.quantity > 1) line += ` x${item.quantity}`
      if (item.notes) line += ` · ${item.notes}`
      if (item.condition !== 'good') line += ` [${item.condition.toUpperCase()}]`
      lines.push(line)
    })
  })

  return lines.join('\n')
}
