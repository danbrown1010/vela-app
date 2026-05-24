import { useEffect } from 'react'
import { getGearItems, getPendingDeletes, removePendingDelete, clearPendingSaves, saveGearItem } from '../utils/gearStorage'
import { getPendingTripSaves, removePendingTripSave, getPendingTripDeletes, removePendingTripDelete } from '../utils/tripStorage'
import { bulkSyncGearToSupabase, deleteGearFromSupabase, syncTripToSupabase, deleteTripFromSupabase, fetchGearFromSupabase } from '../utils/syncManager'
import { getAnthropicKey } from '../utils/secretsManager'

export function useSyncOnLogin(user, setSyncStatus, onError) {
  useEffect(() => {
    if (!user) return

    const syncAll = async () => {
      setSyncStatus('syncing')
      try {
        const pendingTripDeletes = getPendingTripDeletes()
        if (pendingTripDeletes.length > 0) {
          for (const id of pendingTripDeletes) {
            const { error } = await deleteTripFromSupabase(id)
            if (!error) removePendingTripDelete(id)
          }
        }

        const pendingTripSaves = Object.values(getPendingTripSaves())
        if (pendingTripSaves.length > 0) {
          for (const trip of pendingTripSaves) {
            const { error } = await syncTripToSupabase(trip, user.id)
            if (!error) removePendingTripSave(trip.id)
          }
        }

        const pendingDeletes = getPendingDeletes()
        if (pendingDeletes.length > 0) {
          for (const id of pendingDeletes) {
            const { error } = await deleteGearFromSupabase(id)
            if (!error) removePendingDelete(id)
          }
        }

        const localGear = await getGearItems()

        if (localGear.length > 0) {
          const { error } = await bulkSyncGearToSupabase(localGear, user.id)
          if (!error) {
            clearPendingSaves()
          }
        }

        // Pull ALL gear down from Supabase — ensures fresh sessions (incognito,
        // new device) get the full gear list even with no local IndexedDB cache
        const remoteGear = await fetchGearFromSupabase(user.id)
        if (remoteGear.length > 0) {
          const mapped = remoteGear.map(item => ({
            id: item.id,
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            condition: item.condition,
            notes: item.notes ?? '',
            vendor: item.vendor ?? '',
            purchasedFrom: item.purchased_from ?? '',
            purchaseLink: item.purchase_link ?? '',
            onRig: item.on_rig ?? true,
            includeInChecklist: item.include_in_checklist ?? true,
            updatedAt: item.updated_at,
          }))
          for (const item of mapped) {
            await saveGearItem(item)
          }
        }

        await getAnthropicKey(user.id)

        setSyncStatus('idle')
      } catch (err) {
        console.error('Sync failed:', err)
        setSyncStatus('error')
        onError?.('Sync failed — some changes may not have saved. They will retry on next login.')
      }
    }

    syncAll()
  }, [user?.id])
}
