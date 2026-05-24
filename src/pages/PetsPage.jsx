import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../store/index'
import { getAnthropicKey } from '../utils/secretsManager'
import { supabase } from '../lib/supabase'
import { uploadPetPhoto } from '../utils/petPhotoUpload'
import Dog      from 'lucide-react/dist/esm/icons/dog.mjs'
import Cat      from 'lucide-react/dist/esm/icons/cat.mjs'
import Bird     from 'lucide-react/dist/esm/icons/bird.mjs'
import Rabbit   from 'lucide-react/dist/esm/icons/rabbit.mjs'
import PawPrint from 'lucide-react/dist/esm/icons/paw-print.mjs'
import { IconArrowLeft, IconSend, IconCamera, IconPlus } from '../components/icons'

// ─── Constants ────────────────────────────────────────────────────────────────

const ANIMAL_TYPES = [
  { id: 'dog',    label: 'Dog',    Icon: Dog      },
  { id: 'cat',    label: 'Cat',    Icon: Cat      },
  { id: 'bird',   label: 'Bird',   Icon: Bird     },
  { id: 'rabbit', label: 'Rabbit', Icon: Rabbit   },
  { id: 'other',  label: 'Other',  Icon: PawPrint },
]

function getAnimalLabel(type) {
  if (!type || type === 'other') return 'pet'
  return ANIMAL_TYPES.find(t => t.id === type)?.label?.toLowerCase() ?? 'pet'
}

function getAnimalEmoji(type) {
  return { dog: '🐕', cat: '🐈', bird: '🐦', rabbit: '🐇', other: '🐾' }[type] ?? '🐾'
}

function getAnimalIcon(type, size = 32, color = 'currentColor') {
  const found = ANIMAL_TYPES.find(t => t.id === type)
  const Comp = found?.Icon ?? PawPrint
  return <Comp size={size} color={color} strokeWidth={1.5} />
}

// ─── System prompt (dynamic) ──────────────────────────────────────────────────

function getSystemPrompt(animalType) {
  const label = getAnimalLabel(animalType)
  return `You are VELA's pet onboarding assistant helping set up a ${label}'s trail profile in a fun, warm, conversational way.

Rules:
- Ask ONE question at a time
- After each answer drop a fun fact or tidbit about their breed/species
- Keep facts accurate and trail-relevant
- Tone: warm, enthusiastic, like a trail-savvy friend who loves animals
- Never ask multiple questions at once
- When you have all required info output a special JSON block

Required info to collect:
1. Name
2. Male or female
3. Breed / variety / species detail
4. Age (in years)
5. Weight (in lbs)
6. Vaccinations up to date? (yes/no)
7. Any medications or allergies?
8. Vet name and phone (optional — ok to skip)
9. Off-leash or free-roam trained? (yes/no)
10. Water-friendly? (yes/no)
11. Any trail gear? (harness, boots, carrier, etc — ok to skip)

When all collected output EXACTLY:
<pet_profile>
{
  "animal_type": "${animalType}",
  "name": "...",
  "sex": "male|female",
  "breed": "...",
  "age_years": 0,
  "weight_lbs": 0,
  "vaccinations_current": true,
  "medications": [],
  "allergies": [],
  "vet_name": "...",
  "vet_phone": "...",
  "off_leash": true,
  "water_dog": true,
  "gear": [],
  "trail_preferences": {
    "off_leash": true,
    "water_dog": true,
    "heat_sensitive": false
  }
}
</pet_profile>

Followed by a warm closing message and a short trail readiness summary for their companion.`
}

function getInitialMessages(animalType) {
  const label = getAnimalLabel(animalType)
  const emoji = getAnimalEmoji(animalType)
  return [{
    role: 'assistant',
    content: `Hey! I'm VELA's trail companion onboarding assistant ${emoji}\n\nI'm going to set up a trail profile for your ${label} so VELA can factor them into trip planning, safety alerts, and gear recommendations.\n\nLet's start with the basics — what's your trail ${label}'s name?`,
  }]
}

// ─── DB transform ─────────────────────────────────────────────────────────────

function aiProfileToDb(ai, userId, animalType) {
  return {
    user_id: userId,
    animal_type: ai.animal_type ?? animalType,
    name: ai.name,
    breed: ai.breed,
    sex: ai.sex,
    age_years: Number(ai.age_years),
    weight_lbs: Number(ai.weight_lbs),
    vaccinations: ai.vaccinations_current ? [{ status: 'current' }] : [{ status: 'unknown' }],
    medications: (ai.medications ?? []).map(m => typeof m === 'string' ? { name: m } : m),
    allergies: (ai.allergies ?? []).map(a => typeof a === 'string' ? { name: a } : a),
    vet_name: ai.vet_name || null,
    vet_phone: ai.vet_phone || null,
    gear: ai.gear ?? [],
    trail_preferences: {
      off_leash: ai.off_leash ?? false,
      water_dog: ai.water_dog ?? false,
      heat_sensitive: ai.trail_preferences?.heat_sensitive ?? false,
    },
    setup_complete: true,
  }
}

// ─── Trail score ──────────────────────────────────────────────────────────────

function trailScore(pet) {
  let score = 0
  if (pet.vaccinations?.some(v => v.status === 'current')) score += 3
  if (!pet.allergies?.length) score += 2
  if (pet.trail_preferences?.off_leash) score += 2
  if (pet.gear?.length > 0) score += 1
  if (pet.vet_name) score += 1
  if (pet.setup_complete) score += 1
  return Math.min(10, score)
}

function ScoreChip({ score }) {
  const isReady    = score >= 8
  const isMostly   = score >= 5
  const color      = isReady ? 'var(--safe)' : isMostly ? '#d97706' : 'var(--danger)'
  const bgColor    = isReady
    ? 'color-mix(in srgb, var(--safe) 13%, transparent)'
    : isMostly
    ? 'rgba(217,119,6,0.13)'
    : 'color-mix(in srgb, var(--danger) 13%, transparent)'
  const borderColor = isReady
    ? 'color-mix(in srgb, var(--safe) 33%, transparent)'
    : isMostly
    ? 'rgba(217,119,6,0.33)'
    : 'color-mix(in srgb, var(--danger) 33%, transparent)'
  const label = isReady ? 'TRAIL READY' : isMostly ? 'MOSTLY READY' : 'NEEDS SETUP'
  return (
    <div style={{ fontSize: 10, padding: '3px 8px', borderRadius: 8, background: bgColor, border: `1px solid ${borderColor}`, color, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
      {label}
    </div>
  )
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function formatInline(raw) {
  return raw
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:rgba(0,0,0,0.15);padding:1px 5px;border-radius:3px;font-family:var(--font-mono);font-size:11px">$1</code>')
}

function renderMarkdown(text) {
  const cleaned = text.replace(/<pet_profile>[\s\S]*?<\/pet_profile>/g, '').trim()
  const lines = cleaned.split('\n')
  const result = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') { i++; continue }
    if (/^[-*•]\s/.test(line)) {
      const items = []
      while (i < lines.length && /^[-*•]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*•]\s/, ''))
        i++
      }
      result.push(
        <ul key={`ul-${i}`} style={{ margin: '6px 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {items.map((item, j) => <li key={j} style={{ lineHeight: 1.55 }} dangerouslySetInnerHTML={{ __html: formatInline(item) }} />)}
        </ul>
      )
      continue
    }
    result.push(<p key={`p-${i}`} style={{ margin: '3px 0', lineHeight: 1.55 }} dangerouslySetInnerHTML={{ __html: formatInline(line) }} />)
    i++
  }
  return result
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function Stat({ label, value }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 15, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontWeight: 600 }}>{value ?? '—'}</div>
    </div>
  )
}

function Card({ label, children }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      {children}
    </div>
  )
}

function TraitRow({ icon, label, ok }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 12, color: ok ? 'var(--safe)' : 'var(--danger)', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>{label}</span>
    </div>
  )
}

function HealthRow({ label, items, color }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color, fontFamily: 'var(--font-body)' }}>{items.join(', ')}</div>
    </div>
  )
}

// ─── PetSetupChat ─────────────────────────────────────────────────────────────

function PetSetupChat({ onBack, onComplete }) {
  const { user, accent } = useAppStore()
  const [animalType, setAnimalType] = useState(null)
  const [phase, setPhase] = useState('type-select') // 'type-select' | 'chat' | 'photo'
  const [messages, setMessages] = useState([])
  const [savedPet, setSavedPet] = useState(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [apiKey, setApiKey] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const photoInputRef = useRef(null)
  const hasStarted = useRef(false)

  useEffect(() => { getAnthropicKey(user?.id).then(setApiKey) }, [user?.id])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  useEffect(() => {
    if (animalType && !hasStarted.current) {
      hasStarted.current = true
      setMessages(getInitialMessages(animalType))
      setPhase('chat')
    }
  }, [animalType])

  const extractProfile = (text) => {
    const match = text.match(/<pet_profile>([\s\S]*?)<\/pet_profile>/)
    if (!match) return null
    try { return JSON.parse(match[1].trim()) } catch { return null }
  }

  const sendMessage = async () => {
    const content = input.trim()
    if (!content || loading || !apiKey) return
    const userMsg = { role: 'user', content }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: getSystemPrompt(animalType),
          messages: next.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error.message)
      const reply = data.content?.[0]?.text ?? ''
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      const aiProfile = extractProfile(reply)
      if (aiProfile && user) {
        setSaving(true)
        try {
          const { data: saved, error } = await supabase
            .from('pets')
            .insert(aiProfileToDb(aiProfile, user.id, animalType))
            .select()
            .single()
          if (error) throw error
          setSavedPet(saved)
          setPhase('photo')
        } catch (err) {
          console.error('Save pet failed:', err)
        } finally {
          setSaving(false)
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Connection error: ${err.message}. Check your network and try again.` }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handlePhotoFile = async (file) => {
    if (!file || !savedPet) return
    setPhotoUploading(true)
    try {
      const url = await uploadPetPhoto(file, savedPet.id, user.id)
      await supabase.from('pets').update({ photo_url: url }).eq('id', savedPet.id)
      onComplete({ ...savedPet, photo_url: url })
    } catch (err) {
      console.error('Photo upload failed:', err)
      onComplete(savedPet)
    } finally {
      setPhotoUploading(false)
    }
  }

  // ── Phase: type-select ────────────────────────────────────────────────────
  if (phase === 'type-select') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)' }}>
        <div style={{ paddingTop: 'max(12px, env(safe-area-inset-top))', paddingRight: '16px', paddingBottom: '12px', paddingLeft: '16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 20, padding: 0, lineHeight: 1, display: 'flex', alignItems: 'center' }}>←</button>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
            New trail buddy
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', gap: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 16 }}>
              <PawPrint size={48} color="var(--accent)" strokeWidth={1.5} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', marginBottom: 8 }}>
              What kind of trail buddy?
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', lineHeight: 1.6 }}>
              VELA will customize the setup for your companion.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', maxWidth: 320 }}>
            {ANIMAL_TYPES.map(type => (
              <button
                key={type.id}
                onClick={() => setAnimalType(type.id)}
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, transition: 'border-color 0.2s', color: 'var(--text-primary)' }}
              >
                <type.Icon size={36} color="var(--text-primary)" strokeWidth={1.5} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{type.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Phase: photo ──────────────────────────────────────────────────────────
  if (phase === 'photo' && savedPet) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', gap: 20 }}>
          <div style={{ opacity: 0.6 }}>{getAnimalIcon(savedPet.animal_type, 56, 'var(--text-primary)')}</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', marginBottom: 8 }}>
              Add a photo of {savedPet.name}?
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', lineHeight: 1.6 }}>
              You can always add one later from their profile.
            </div>
          </div>

          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            onChange={e => handlePhotoFile(e.target.files?.[0])}
            style={{ display: 'none' }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 280 }}>
            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={photoUploading}
              style={{ padding: '14px', borderRadius: 12, border: 'none', background: accent, color: '#fff', fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: photoUploading ? 0.7 : 1 }}
            >
              {photoUploading ? 'Uploading…' : 'Add photo now'}
            </button>
            <button
              onClick={() => onComplete(savedPet)}
              disabled={photoUploading}
              style={{ padding: '14px', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: 15, cursor: 'pointer' }}
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Phase: chat ───────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)' }}>
      <div style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 'max(12px, env(safe-area-inset-top))', paddingRight: '16px', paddingBottom: '12px', paddingLeft: '16px' }}>
          <button
            onClick={onBack}
            style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            <IconArrowLeft style={{ width: 16, height: 16, color: 'var(--text-secondary)' }} />
          </button>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.08em', margin: 0 }}>NEW TRAIL PROFILE</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.06em', margin: '2px 0 0' }}>POWERED BY CLAUDE · VELA AI</p>
          </div>
          {saving && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>SAVING…</div>}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: msg.role === 'user' ? '80%' : '88%',
              padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-card)',
              border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
              color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
              fontFamily: 'var(--font-body)', fontSize: 14,
            }}>
              {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '12px 16px', borderRadius: '16px 16px 16px 4px', background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', gap: 5, alignItems: 'center' }}>
              {[0, 1, 2].map(j => <div key={j} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--text-tertiary)', animation: 'pulse 1s ease-in-out infinite', animationDelay: `${j * 0.18}s` }} />)}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)', flexShrink: 0, paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}>
        {!apiKey && (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', marginBottom: 8, textAlign: 'center' }}>
            Add your Anthropic API key in Settings → AI Configuration to enable chat.
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder="Type your answer…"
            rows={1}
            disabled={!apiKey || saving}
            style={{ flex: 1, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 14, outline: 'none', resize: 'none', lineHeight: 1.4, maxHeight: 120, overflowY: 'auto', opacity: apiKey && !saving ? 1 : 0.5 }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading || !apiKey || saving}
            style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', flexShrink: 0, background: input.trim() && !loading && apiKey && !saving ? 'var(--accent)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() && !loading && apiKey && !saving ? 'pointer' : 'default', transition: 'background 0.15s' }}
          >
            <IconSend style={{ width: 18, height: 18, color: '#fff' }} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── PetProfile ───────────────────────────────────────────────────────────────

function PetProfile({ pet, onBack, onDeleted, onReOnboard, onUpdate }) {
  const { user } = useAppStore()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const photoInputRef = useRef(null)

  const score = trailScore(pet)
  const vaccsOk = pet.vaccinations?.some(v => v.status === 'current')
  const meds = pet.medications?.map(m => m.name ?? m).filter(Boolean)
  const allergies = pet.allergies?.map(a => a.name ?? a).filter(Boolean)
  const gear = Array.isArray(pet.gear) ? pet.gear : []
  const prefs = pet.trail_preferences ?? {}

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadPetPhoto(file, pet.id, user.id)
      await onUpdate({ photo_url: url })
    } catch (err) {
      console.error('Photo upload failed:', err)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    await supabase.from('pets').delete().eq('id', pet.id).eq('user_id', user.id)
    onDeleted()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)' }}>

      {/* Header */}
      <div style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', flexShrink: 0, paddingTop: 'max(12px, env(safe-area-inset-top))', paddingRight: '16px', paddingBottom: '12px', paddingLeft: '16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onBack} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <IconArrowLeft style={{ width: 16, height: 16, color: 'var(--text-secondary)' }} />
        </button>
        <div style={{ flex: 1 }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', margin: 0, textTransform: 'uppercase' }}>Trail Profile</p>
        </div>
        <ScoreChip score={score} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '24px 16px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Photo + name */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div
              onClick={() => photoInputRef.current?.click()}
              style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--bg-card)', border: '3px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer', position: 'relative' }}
            >
              {pet.photo_url ? (
                <img src={pet.photo_url} alt={pet.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                getAnimalIcon(pet.animal_type, 44, 'var(--text-tertiary)')
              )}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', padding: '5px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconCamera style={{ width: 14, height: 14, color: '#fff' }} />
              </div>
              {uploading && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="animate-spin" style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                </div>
              )}
            </div>
            {!pet.photo_url && (
              <div onClick={() => photoInputRef.current?.click()} style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-body)', marginTop: 2, cursor: 'pointer' }}>
                Tap to add photo
              </div>
            )}
            <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', marginTop: 8 }}>{pet.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}>{pet.breed}</div>
          </div>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              ['Age',    `${pet.age_years} yr${pet.age_years !== 1 ? 's' : ''}`],
              ['Weight', `${pet.weight_lbs} lbs`],
              ['Sex',    pet.sex ? (pet.sex.charAt(0).toUpperCase() + pet.sex.slice(1)) : '—'],
              ['Type',   ANIMAL_TYPES.find(t => t.id === pet.animal_type)?.label ?? 'Pet'],
            ].map(([label, value]) => (
              <Stat key={label} label={label} value={value} />
            ))}
          </div>

          {/* Trail traits */}
          <Card label="Trail Traits">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <TraitRow icon={prefs.off_leash ? '✓' : '✗'} label="Off-leash"       ok={prefs.off_leash} />
              <TraitRow icon={prefs.water_dog ? '✓' : '✗'} label="Water-friendly"  ok={prefs.water_dog} />
              <TraitRow icon={vaccsOk ? '✓' : '⚠'}         label="Vaccinations"    ok={vaccsOk} />
              <TraitRow icon={prefs.heat_sensitive ? '⚠' : '✓'} label="Heat tolerant" ok={!prefs.heat_sensitive} />
            </div>
          </Card>

          {/* Health */}
          {(meds?.length > 0 || allergies?.length > 0) && (
            <Card label="Health">
              {meds?.length > 0    && <HealthRow label="Medications" items={meds}      color="var(--text-secondary)" />}
              {allergies?.length > 0 && <HealthRow label="Allergies"   items={allergies} color="var(--danger)" />}
            </Card>
          )}

          {/* Gear */}
          {gear.length > 0 && (
            <Card label="Trail Gear">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {gear.map((item, i) => (
                  <div key={i} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>{item}</div>
                ))}
              </div>
            </Card>
          )}

          {/* Vet */}
          {(pet.vet_name || pet.vet_phone) && (
            <Card label="Veterinarian">
              <div style={{ fontSize: 14, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
                {pet.vet_name}
                {pet.vet_phone && <span style={{ color: 'var(--text-tertiary)' }}> · {pet.vet_phone}</span>}
              </div>
            </Card>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={onReOnboard}
              style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}
            >
              Re-run onboarding chat
            </button>
            {confirmDelete ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: 'var(--danger)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: deleting ? 0.6 : 1 }}>
                  {deleting ? 'Removing…' : 'Confirm remove'}
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.06)', color: 'var(--danger)', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Remove {pet.name}
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

// ─── PetRoster ────────────────────────────────────────────────────────────────

function PetRoster({ pets, loading, onBack, onAddPet, onSelectPet }) {
  const { accent } = useAppStore()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)' }}>
      <div style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', flexShrink: 0, paddingTop: 'max(12px, env(safe-area-inset-top))', paddingRight: '16px', paddingBottom: '12px', paddingLeft: '16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        {onBack && (
          <button onClick={onBack} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <IconArrowLeft style={{ width: 16, height: 16, color: 'var(--text-secondary)' }} />
          </button>
        )}
        <div style={{ flex: 1 }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.08em', margin: 0 }}>TRAIL COMPANIONS</p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.06em', margin: '2px 0 0' }}>PET COMPANION · VELA</p>
        </div>
        {pets.length > 0 && (
          <button onClick={onAddPet} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <IconPlus style={{ width: 16, height: 16, color: '#fff' }} />
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}>Loading…</div>
          </div>
        ) : pets.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 32, gap: 16, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PawPrint size={30} color="var(--accent)" strokeWidth={1.5} />
            </div>
            <div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>No trail companions yet</p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.5 }}>Add your first trail companion and VELA will factor them into trip planning and safety alerts.</p>
            </div>
            <button onClick={onAddPet} style={{ marginTop: 8, padding: '13px 28px', borderRadius: 12, border: 'none', background: accent, color: '#fff', fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              Add trail companion
            </button>
          </div>
        ) : (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pets.map(pet => {
              const score = trailScore(pet)
              return (
                <button
                  key={pet.id}
                  onClick={() => onSelectPet(pet)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, textAlign: 'left', cursor: 'pointer', width: '100%' }}
                >
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                    {pet.photo_url ? (
                      <img src={pet.photo_url} alt={pet.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      getAnimalIcon(pet.animal_type, 26, 'var(--text-tertiary)')
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', marginBottom: 2 }}>{pet.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}>
                      {pet.breed} · {pet.age_years} yr{pet.age_years !== 1 ? 's' : ''} · {pet.weight_lbs} lbs
                    </div>
                  </div>
                  <ScoreChip score={score} />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PetsPage({ onBack }) {
  const { user } = useAppStore()
  const [view, setView] = useState('roster')
  const [selectedPet, setSelectedPet] = useState(null)
  const [pets, setPets] = useState([])
  const [loadingPets, setLoadingPets] = useState(true)

  const loadPets = async () => {
    if (!user) return
    setLoadingPets(true)
    const { data } = await supabase.from('pets').select('*').eq('user_id', user.id).order('created_at', { ascending: true })
    setPets(data ?? [])
    setLoadingPets(false)
  }

  useEffect(() => { loadPets() }, [user?.id])

  const handleUpdatePet = async (updates) => {
    if (!selectedPet) return
    const { error } = await supabase
      .from('pets')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', selectedPet.id)
      .eq('user_id', user.id)
    if (!error) {
      const updated = { ...selectedPet, ...updates }
      setSelectedPet(updated)
      setPets(prev => prev.map(p => p.id === selectedPet.id ? updated : p))
    }
  }

  if (view === 'setup') {
    return (
      <PetSetupChat
        onBack={() => setView('roster')}
        onComplete={async (saved) => {
          await loadPets()
          setSelectedPet(saved)
          setView('profile')
        }}
      />
    )
  }

  if (view === 'profile' && selectedPet) {
    return (
      <PetProfile
        pet={selectedPet}
        onBack={() => setView('roster')}
        onDeleted={async () => {
          setSelectedPet(null)
          await loadPets()
          setView('roster')
        }}
        onReOnboard={() => setView('setup')}
        onUpdate={handleUpdatePet}
      />
    )
  }

  return (
    <PetRoster
      pets={pets}
      loading={loadingPets}
      onBack={onBack}
      onAddPet={() => setView('setup')}
      onSelectPet={(pet) => { setSelectedPet(pet); setView('profile') }}
    />
  )
}
