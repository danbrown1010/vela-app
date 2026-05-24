import { useEffect } from 'react'
import {
  getGearItems,
  getPendingDeletes, removePendingDelete,
  removePendingSave,
  clearGearItemPendingSync,
  saveGearItemLocal,
} from '../utils/gearStorage'
import { getPendingTripSaves, removePendingTripSave, getPendingTripDeletes, removePendingTripDelete } from '../utils/tripStorage'
import { syncGearToSupabase, deleteGearFromSupabase, syncTripToSupabase, deleteTripFromSupabase, fetchGearFromSupabase } from '../utils/syncManager'
import { getAnthropicKey } from '../utils/secretsManager'
import { setLastSyncTime } from '../utils/pendingSync'

// Returns { succeeded, failed, errors, offline, unexpected }
export async function runLoginSync(user, setSyncStatus, onError) {
  if (!navigator.onLine) {
    return { succeeded: 0, failed: 0, errors: [], offline: true, unexpected: false }
  }

  setSyncStatus('syncing')

  let succeeded = 0
  let failed = 0
  const errors = []

  try {
    // ── Trip deletes ──────────────────────────────────────────────────────────
    for (const id of getPendingTripDeletes()) {
      const { error } = await deleteTripFromSupabase(id)
      if (!error) { removePendingTripDelete(id); succeeded++ }
      else { failed++; errors.push({ type: 'trip-delete', id, message: error.message }) }
    }

    // ── Trip saves ────────────────────────────────────────────────────────────
    for (const trip of Object.values(getPendingTripSaves())) {
      const { error } = await syncTripToSupabase(trip, user.id)
      if (!error) { removePendingTripSave(trip.id); succeeded++ }
      else { failed++; errors.push({ type: 'trip', id: trip.id, message: error.message }) }
    }

    // ── Gear deletes ──────────────────────────────────────────────────────────
    for (const id of getPendingDeletes()) {
      const { error } = await deleteGearFromSupabase(id)
      if (!error) { removePendingDelete(id); succeeded++ }
      else { failed++; errors.push({ type: 'gear-delete', id, message: error.message }) }
    }

    // ── Gear saves (per-item — never bulk-clear on partial failure) ───────────
    const localGear = await getGearItems()
    for (const item of localGear) {
      if (!item.pending_sync) continue
      const { error } = await syncGearToSupabase(item, user.id)
      if (!error) {
        await clearGearItemPendingSync(item.id)
        removePendingSave(item.id)
        succeeded++
      } else {
        failed++
        errors.push({ type: 'gear', id: item.id, message: error.message })
      }
    }

    // ── Pull server gear (fresh device / multi-device) ────────────────────────
    // Uses saveGearItemLocal so we don't trigger redundant Supabase round-trips
    // and never set pending_sync=true for server-authoritative rows.
    const remoteGear = await fetchGearFromSupabase(user.id)
    for (const item of remoteGear) {
      await saveGearItemLocal({
        id:               item.id,
        name:             item.name,
        category:         item.category,
        quantity:         item.quantity,
        condition:        item.condition,
        notes:            item.notes ?? '',
        vendor:           item.vendor ?? '',
        purchasedFrom:    item.purchased_from ?? '',
        purchaseLink:     item.purchase_link ?? '',
        onRig:            item.on_rig ?? true,
        includeInChecklist: item.include_in_checklist ?? true,
        updatedAt:        item.updated_at,
      })
    }

    await getAnthropicKey(user.id)

    // Only advance the sync timestamp when at least one item reached the server.
    if (succeeded > 0) setLastSyncTime()

    setSyncStatus(failed > 0 ? 'error' : 'idle')

  } catch (err) {
    console.error('Sync failed:', err)
    setSyncStatus('error')
    onError?.('Sync failed — some changes may not have saved. They will retry on next login.')
    return {
      succeeded,
      failed: failed + 1,
      errors: [...errors, { type: 'unexpected', message: err.message }],
      offline: false,
      unexpected: true,
    }
  }

  return { succeeded, failed, errors, offline: false, unexpected: false }
}

export function useSyncOnLogin(user, setSyncStatus, onError) {
  useEffect(() => {
    if (!user) return
    runLoginSync(user, setSyncStatus, onError)
  }, [user?.id])
}
