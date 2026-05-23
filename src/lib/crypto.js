// PBKDF2-SHA256 + AES-GCM 256. Web Crypto API only — no dependencies.
// Envelope: { v:1, mode:"passphrase"|"auto", salt:<b64 16B>, iv:<b64 12B>, ciphertext:<b64> }
//
// APP_SECRET is NOT a real secret — it ships in the JS bundle and can be read
// by anyone who reverses it. Its purpose is to make a raw DB leak non-trivial
// to read, not to resist an attacker who has both the DB dump and the bundle.
const APP_SECRET = 'vela-ha-v1-app-fixed-secret-not-for-security-a8f3c2e7d019b4'

function toB64(buf) {
  let s = ''
  const b = new Uint8Array(buf)
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i])
  return btoa(s)
}

function fromB64(b64) {
  const s = atob(b64)
  const b = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i)
  return b
}

async function deriveKey(material, salt) {
  const raw = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(material),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 600_000, hash: 'SHA-256' },
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptToken(plaintext, { mode, passphrase, userId }) {
  const salt     = crypto.getRandomValues(new Uint8Array(16))
  const iv       = crypto.getRandomValues(new Uint8Array(12))
  const material = mode === 'passphrase' ? passphrase : userId + APP_SECRET
  const key      = await deriveKey(material, salt)
  const ct       = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  )
  return JSON.stringify({ v: 1, mode, salt: toB64(salt), iv: toB64(iv), ciphertext: toB64(ct) })
}

export async function decryptToken(envelopeJson, { passphrase, userId }) {
  const { v, mode, salt, iv, ciphertext } = JSON.parse(envelopeJson)
  if (v !== 1) throw new Error('Unknown envelope version')
  const material = mode === 'passphrase' ? passphrase : userId + APP_SECRET
  const key      = await deriveKey(material, fromB64(salt))
  const pt       = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(iv) },
    key,
    fromB64(ciphertext),
  )
  return new TextDecoder().decode(pt)
}
