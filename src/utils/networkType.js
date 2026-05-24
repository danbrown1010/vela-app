export function isOnWifi() {
  if (!navigator.onLine) return false
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  if (!conn) return true  // No Connection API (Safari iOS) → assume Wi-Fi
  if (conn.type === 'wifi' || conn.type === 'ethernet') return true
  if (conn.type === 'cellular') return false
  // 'none', 'unknown', 'other' → assume Wi-Fi to avoid false negatives
  return true
}

export function onNetworkChange(callback) {
  const conn = navigator.connection
  if (conn) conn.addEventListener('change', callback)
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    if (conn) conn.removeEventListener('change', callback)
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}
