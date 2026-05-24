import { v4 as uuidv4 } from 'uuid'
import { supabase } from '../lib/supabase'

function isValidUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

function toUUID(id) {
  return isValidUUID(id) ? id : uuidv4()
}

// A delete that finds no matching row is a success — the desired state
// (row absent) is already true. PGRST116 is a PostgREST "no rows" code;
// the string check is a defensive fallback in case the SDK changes.
function isAlreadyGone(error) {
  if (!error) return false
  if (error.code === 'PGRST116') return true
  if (error.message?.toLowerCase().includes('no rows')) return true
  return false
}

function gearRow(item, userId) {
  return {
    id: toUUID(item.id),
    user_id: userId,
    name: item.name,
    category: item.category,
    quantity: item.quantity ?? 1,
    condition: item.condition ?? 'good',
    notes: item.notes ?? '',
    vendor: item.vendor ?? '',
    purchased_from: item.purchasedFrom ?? '',
    purchase_link: item.purchaseLink ?? '',
    on_rig: item.onRig ?? false,
    include_in_checklist: item.includeInChecklist ?? false,
    updated_at: new Date().toISOString(),
  }
}

// ─── TRIPS ────────────────────────────────────────────────────────────────────

export async function syncTripToSupabase(trip, userId) {
  const row = {
    id: toUUID(trip.id),
    user_id: userId,
    name: trip.name,
    type: trip.type,
    region: trip.region,
    departure_date: trip.departureDate || null,
    return_date: trip.returnDate || null,
    status: trip.status ?? 'planning',
    waypoints: trip.waypoints ?? [],
    campsites: trip.campsites ?? [],
    data: {
      checklist: trip.checklist ?? [],
      gearLists: trip.gearLists ?? [],
      partners: trip.partners ?? [],
      notes: trip.notes ?? '',
      types: trip.types ?? [],
    },
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('trips')
    .upsert(row, { onConflict: 'id' })

  if (error) {
    console.error('[syncTrip] UPSERT ERROR:', error)
  }

  return { data, error }
}

export async function fetchTripsFromSupabase(userId) {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) console.error('Trip fetch error:', error)
  return data ?? []
}

export async function deleteTripFromSupabase(tripId) {
  // Non-UUID IDs (e.g. mock-*) never existed server-side — skip the call.
  if (!isValidUUID(tripId)) return { error: null }

  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('id', tripId)

  if (error && !isAlreadyGone(error)) {
    console.error('Trip delete error:', error)
    return { error }
  }
  return { error: null }
}

// ─── GEAR ─────────────────────────────────────────────────────────────────────

export async function syncGearToSupabase(item, userId) {
  const { data, error } = await supabase
    .from('gear_items')
    .upsert(gearRow(item, userId), { onConflict: 'id' })

  if (error) console.error('Gear sync error:', error)
  return { data, error }
}

export async function fetchGearFromSupabase(userId) {
  const { data, error } = await supabase
    .from('gear_items')
    .select('*')
    .eq('user_id', userId)
    .order('category', { ascending: true })

  if (error) console.error('Gear fetch error:', error)
  return data ?? []
}

export async function deleteGearFromSupabase(itemId) {
  if (!isValidUUID(itemId)) return { error: null }

  const { error } = await supabase
    .from('gear_items')
    .delete()
    .eq('id', itemId)

  if (error && !isAlreadyGone(error)) {
    console.error('Gear delete error:', error)
    return { error }
  }
  return { error: null }
}

export async function bulkSyncGearToSupabase(items, userId) {
  const rows = items.map(item => gearRow(item, userId))

  const { data, error } = await supabase
    .from('gear_items')
    .upsert(rows, { onConflict: 'id' })

  if (error) console.error('Bulk gear sync error:', error)
  return { data, error }
}

// ─── TRACKS ───────────────────────────────────────────────────────────────────

export async function syncTrackToSupabase(track, userId) {
  const row = {
    id:                       track.id,
    user_id:                  userId,
    trip_id:                  track.trip_id ?? null,
    name:                     track.name,
    source_format:            track.source_format,
    source_file_path:         track.source_file_path ?? null,
    geojson:                  track.geojson,
    point_count:              track.point_count ?? 0,
    simplified:               track.simplified ?? false,
    simplification_tolerance: track.simplification_tolerance ?? null,
    distance_m:               track.distance_m,
    bbox:                     track.bbox,
    updated_at:               new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('tracks')
    .upsert(row, { onConflict: 'id' })

  if (error) console.error('Track sync error:', error)
  return { data, error }
}

export async function fetchTracksFromSupabase(userId) {
  const { data, error } = await supabase
    .from('tracks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) console.error('Track fetch error:', error)
  return data ?? []
}

export async function deleteTrackFromSupabase(trackId) {
  if (!isValidUUID(trackId)) return { error: null }

  const { error } = await supabase
    .from('tracks')
    .delete()
    .eq('id', trackId)

  if (error && !isAlreadyGone(error)) {
    console.error('Track delete error:', error)
    return { error }
  }
  return { error: null }
}
