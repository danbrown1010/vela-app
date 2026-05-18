import { supabase } from '../lib/supabase'

// localStorage cache keys: vela-integration-<name>
const lsKey = (name) => `vela-integration-${name}`

/**
 * Load an integration config. Returns cached value immediately if present;
 * pulls fresh from Supabase in the background and overwrites cache.
 *
 *   const cfg = await getIntegration('starlink', { proxies: [] })
 */
export async function getIntegration(name, defaults = {}) {
  let cached = null
  try {
    const raw = localStorage.getItem(lsKey(name))
    if (raw) cached = JSON.parse(raw)
  } catch {
    // bad cache; ignore
  }

  // Fire-and-forget refresh from Supabase
  refreshFromSupabase(name).catch((err) =>
    console.warn(`Integration ${name} refresh failed:`, err)
  )

  return { ...defaults, ...(cached ?? {}) }
}

/**
 * Save an integration config. Writes localStorage immediately, then upserts
 * to Supabase. If Supabase fails (offline, unauth'd), the LS write still wins.
 */
export async function saveIntegration(name, config, userId) {
  try {
    localStorage.setItem(lsKey(name), JSON.stringify(config))
  } catch (err) {
    console.error(`Failed to cache integration ${name}:`, err)
  }

  if (!userId) return { ok: true, synced: false }

  const { error } = await supabase
    .from('user_integrations')
    .upsert(
      { user_id: userId, integration: name, config },
      { onConflict: 'user_id,integration' }
    )

  if (error) {
    console.error(`Failed to sync integration ${name}:`, error)
    return { ok: true, synced: false, error }
  }
  return { ok: true, synced: true }
}

export async function clearIntegration(name, userId) {
  localStorage.removeItem(lsKey(name))
  if (!userId) return
  const { error } = await supabase
    .from('user_integrations')
    .delete()
    .eq('user_id', userId)
    .eq('integration', name)
  if (error) console.error(`Failed to clear integration ${name}:`, error)
}

async function refreshFromSupabase(name) {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData?.user?.id
  if (!userId) return

  const { data, error } = await supabase
    .from('user_integrations')
    .select('config')
    .eq('user_id', userId)
    .eq('integration', name)
    .maybeSingle()

  if (error || !data) return
  try {
    localStorage.setItem(lsKey(name), JSON.stringify(data.config))
  } catch {
    // ignore
  }
}
