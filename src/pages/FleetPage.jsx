import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/index'
import { useFleet } from '../hooks/useFleet'
import { getAnthropicKey } from '../utils/secretsManager'

const VEHICLE_SYSTEM_PROMPT = `You are VELA's vehicle onboarding assistant — knowledgeable, enthusiastic about overlanding rigs, and efficient.

Your job is to gather vehicle information through a friendly conversation and pre-fill as much data as possible from your knowledge of make/model/trim specs.

RULES:
- Ask ONE question at a time
- After receiving make/model/trim/year, immediately tell the user what you already know about that vehicle's factory specs — confirm with them
- If user provides VIN, use it to confirm build options
- Be enthusiastic about cool mods (lift kits, winches, camper tops)
- Drop occasional overlanding knowledge (e.g. "BFG KO2s are the go-to tire for mixed terrain — great choice")
- Keep responses concise — 2-3 sentences max per message plus the question

QUESTIONS TO ASK IN ORDER:
1. What do you call your rig? (nickname)
2. Year, make, model, and trim?
3. After getting make/model/trim: Tell them factory specs you know. Ask if they want to share VIN for exact build verification. If yes, confirm specs from VIN. If no, use what you know + ask clarifying questions.
4. What color?
5. Current mileage?
6. Transmission — auto or manual?
7. Any suspension lift? Brand and height?
8. Wheel and tire setup?
9. Bumpers, sliders, armor?
10. Recovery gear? (winch rating, recovery boards, etc)
11. Camping/sleeping setup?
12. Power setup? (batteries, solar, alternator, compressor, switch panel)
13. Electronics and navigation? (dash cam, GPS, communication)
14. Any other mods worth noting?
15. What's the license plate? (optional)

After all info collected output EXACTLY:

<vehicle_profile>
{
  "nickname": "...",
  "year": 2014,
  "make": "...",
  "model": "...",
  "trim": "...",
  "color": "...",
  "vin": "...",
  "license_plate": "...",
  "current_mileage": 0,
  "suspension": { "lift_height": "4 inch", "lift_brand": "...", "shocks": "...", "notes": "..." },
  "wheels_tires": { "tire_brand": "...", "tire_model": "...", "tire_size": "...", "wheel_brand": "...", "wheel_size": "...", "notes": "..." },
  "armor": { "front_bumper": "...", "rear_bumper": "...", "sliders": "...", "skid_plates": "...", "tire_carrier": "...", "notes": "..." },
  "recovery": { "winch_brand": "...", "winch_rating": "...", "recovery_boards": "...", "hi_lift": "...", "kinetic_rope": "...", "notes": "..." },
  "camping": { "sleeping": "...", "awning": "...", "kitchen": "...", "storage": "...", "water": "...", "notes": "..." },
  "electrical": { "primary_battery": "...", "solar": "...", "alternator": "...", "compressor": "...", "switch_panel": "...", "inverter": "...", "notes": "..." },
  "navigation": { "gps": "...", "communication": "...", "dash_cam": "...", "notes": "..." },
  "lighting": { "light_bar": "...", "driving_lights": "...", "notes": "..." },
  "drivetrain": { "engine": "...", "transmission": "...", "transfer_case": "...", "front_axle": "...", "rear_axle": "...", "lockers": "...", "gear_ratio": "...", "notes": "..." },
  "other_mods": { "items": [], "notes": "..." }
}
</vehicle_profile>

Then give a warm closing summary of the rig — like a mechanic admiring a well-built overlanding rig.`

// ─── Shared styles ─────────────────────────────────────────────────────────────

const pageWrap  = { display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)' }
const headerStyle = { padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', flexShrink: 0 }
const backBtn   = { background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 20, padding: 0, flexShrink: 0 }
const monoLabel = { fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }
const inputStyle = { width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }

const VehicleIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size, flexShrink: 0 }}>
    <rect x="1" y="3" width="15" height="13" rx="2"/>
    <path d="M16 8h4l3 3v5h-7V8z"/>
    <circle cx="5.5" cy="18.5" r="2.5"/>
    <circle cx="18.5" cy="18.5" r="2.5"/>
  </svg>
)

const ChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, flexShrink: 0 }}>
    <path d="M9 18l6-6-6-6"/>
  </svg>
)

// ─── Fleet Roster ──────────────────────────────────────────────────────────────

function FleetRoster({ vehicles, loading, isPro, canAddVehicle, onAdd, onSelect, user }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  if (vehicles.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px' }}>
        <VehicleIcon size={48} color="var(--accent)" />
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', marginTop: 16, marginBottom: 8 }}>No rigs in your fleet</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', lineHeight: 1.6, marginBottom: 28, maxWidth: 280, margin: '0 auto 28px' }}>
          Add your rig and VELA will pre-fill specs, track maintenance, and keep your build sheet up to date.
        </div>
        <button onClick={onAdd} style={{ background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '12px 28px', color: '#fff', fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
          Add your rig
        </button>
        {import.meta.env.DEV && (
          <button
            onClick={async () => {
              const { seedChomp } = await import('../utils/seedChomp')
              await seedChomp(user.id)
              window.location.reload()
            }}
            style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-tertiary)', fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer', display: 'block', margin: '12px auto 0' }}
          >
            DEV: seed Chomp
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
      {vehicles.map(v => (
        <div key={v.id} onClick={() => onSelect(v)}
          style={{ background: 'var(--bg-card)', border: `1px solid ${v.is_primary ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 14, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
          <div style={{ width: 56, height: 56, borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {v.photo_url
              ? <img src={v.photo_url} alt={v.nickname} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <VehicleIcon size={28} color="var(--accent)" />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
                {v.nickname || `${v.year} ${v.make}`}
              </div>
              {v.is_primary && (
                <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 8, padding: '1px 6px', letterSpacing: '0.06em' }}>PRIMARY</div>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}>
              {[v.year, v.make, v.model, v.trim].filter(Boolean).join(' ')}
            </div>
            {v.current_mileage && (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 3 }}>
                {v.current_mileage.toLocaleString()} mi
              </div>
            )}
          </div>
          <ChevronRight />
        </div>
      ))}

      {canAddVehicle() ? (
        <button onClick={onAdd} style={{ width: '100%', padding: 14, borderRadius: 14, border: '2px dashed var(--border)', background: 'transparent', color: 'var(--accent)', fontSize: 14, fontWeight: 500, fontFamily: 'var(--font-body)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}>
          + Add another rig
        </button>
      ) : (
        <div style={{ background: 'rgba(196,82,26,0.08)', border: '1px solid var(--accent)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--font-body)', lineHeight: 1.5, marginTop: 4, textAlign: 'center' }}>
          Upgrade to PRO for unlimited vehicles in your fleet.
        </div>
      )}
    </div>
  )
}

// ─── Vehicle Setup Chat ────────────────────────────────────────────────────────

function VehicleSetupChat({ onComplete, onCancel }) {
  const { user } = useAppStore()
  const [apiKey, setApiKey]         = useState(null)
  const [messages, setMessages]     = useState([])
  const [input, setInput]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [vehicleData, setVehicleData] = useState(null)
  const [setupDone, setSetupDone]   = useState(false)
  const messagesEndRef              = useRef(null)
  const hasStarted                  = useRef(false)

  // Load API key first, then start chat once it's ready
  useEffect(() => { getAnthropicKey(user?.id).then(setApiKey) }, [user?.id])
  useEffect(() => {
    if (!apiKey || hasStarted.current) return
    hasStarted.current = true
    startChat(apiKey)
  }, [apiKey])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const callClaude = async (msgs, key, maxTokens = 500) => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: maxTokens, system: VEHICLE_SYSTEM_PROMPT, messages: msgs }),
    })
    const data = await res.json()
    console.log('[Fleet] Claude response:', JSON.stringify(data).slice(0, 300))
    if (data.error) throw new Error(data.error.message || `API error: ${data.error.type}`)
    const text = data.content?.[0]?.text
    if (!text) throw new Error('Empty response — check API key in Settings')
    return text
  }

  const startChat = async (key) => {
    if (!key) return
    setLoading(true)
    try {
      const reply = await callClaude([{ role: 'user', content: 'Start the vehicle setup. Ask your first question.' }], key, 300)
      setMessages([{ role: 'assistant', content: reply }])
    } catch (err) {
      console.error('Chat start error:', err)
      setMessages([{ role: 'assistant', content: `Setup error: ${err.message}` }])
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || loading || !apiKey) return
    const userMsg = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    try {
      const reply = await callClaude(newMessages, apiKey, 1500)

      const profileMatch = reply.match(/<vehicle_profile>([\s\S]*?)<\/vehicle_profile>/)
      if (profileMatch) {
        try {
          const jsonStr = profileMatch[1].trim()
          console.log('[Fleet] Profile JSON:', jsonStr.slice(0, 200))
          const parsed = JSON.parse(jsonStr)
          setVehicleData(parsed)
          setSetupDone(true)
        } catch (e) {
          console.error('[Fleet] Profile parse error:', e.message)
          console.error('[Fleet] Raw JSON:', profileMatch[1].slice(0, 500))
        }
      }

      const cleanReply = reply.replace(/<vehicle_profile>[\s\S]*?<\/vehicle_profile>/g, '').trim()
      setMessages(prev => [...prev, { role: 'assistant', content: cleanReply }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Try again.' }])
    } finally {
      setLoading(false)
    }
  }

  const BotAvatar = () => (
    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <VehicleIcon size={14} color="var(--accent)" />
    </div>
  )

  return (
    <div style={pageWrap}>
      <div style={{ ...headerStyle, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onCancel} style={backBtn}>←</button>
        <div>
          <div style={monoLabel}>Add to fleet</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}>Claude will pre-fill your specs</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!apiKey && !loading && (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-tertiary)', fontSize: 13, fontFamily: 'var(--font-body)' }}>
            Add your Anthropic API key in Settings to enable Claude setup.
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8 }}>
            {msg.role === 'assistant' && <BotAvatar />}
            <div style={{
              maxWidth: '80%', padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-card)',
              border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
              color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
              fontSize: 14, lineHeight: 1.6, fontFamily: 'var(--font-body)', whiteSpace: 'pre-wrap',
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <BotAvatar />
            <div style={{ padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px 16px 16px 4px', display: 'flex', gap: 6, alignItems: 'center' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>
        )}

        {setupDone && vehicleData && (
          <div style={{ background: 'rgba(74,124,63,0.12)', border: '1px solid var(--safe)', borderRadius: 12, padding: '14px 16px', marginTop: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--safe)', fontFamily: 'var(--font-body)', marginBottom: 4 }}>✓ Rig profile complete!</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', marginBottom: 12 }}>
              Ready to add {vehicleData.nickname || vehicleData.make} to your fleet.
            </div>
            <button onClick={() => onComplete(vehicleData)} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
              Add to fleet →
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {!setupDone && (
        <div style={{ display: 'flex', gap: 8, padding: '10px 16px', paddingBottom: 'calc(10px + env(safe-area-inset-bottom))', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Reply..."
            style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: '10px 16px', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 14, outline: 'none' }}
          />
          <button onClick={sendMessage} disabled={!input.trim() || loading}
            style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid var(--border)', background: input.trim() && !loading ? 'var(--accent)' : 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() ? 'pointer' : 'default', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim() && !loading ? '#fff' : 'var(--text-tertiary)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Vehicle Detail ────────────────────────────────────────────────────────────

function VehicleDetail({ vehicle, onBack, onUpdate, onDelete, user }) {
  const [tab, setTab]               = useState('overview')
  const [uploading, setUploading]   = useState(false)
  const [maintenanceLog, setMaintenanceLog] = useState([])
  const [intervals, setIntervals]   = useState([])
  const [loadingMaint, setLoadingMaint] = useState(false)
  const photoInputRef               = useRef(null)

  useEffect(() => { if (tab === 'maintenance') loadMaintenance() }, [tab])

  const loadMaintenance = async () => {
    setLoadingMaint(true)
    const [logRes, intRes] = await Promise.all([
      supabase.from('maintenance_log').select('*').eq('vehicle_id', vehicle.id).order('performed_at', { ascending: false }),
      supabase.from('service_intervals').select('*').eq('vehicle_id', vehicle.id).order('service_type'),
    ])
    setMaintenanceLog(logRes.data ?? [])
    setIntervals(intRes.data ?? [])
    setLoadingMaint(false)
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${user.id}/${vehicle.id}.${ext}`
      await supabase.storage.from('vehicle-photos').upload(path, file, { upsert: true })
      const { data } = supabase.storage.from('vehicle-photos').getPublicUrl(path)
      await onUpdate(vehicle.id, { photo_url: data.publicUrl })
    } catch (err) {
      console.error('Photo upload error:', err)
    } finally {
      setUploading(false)
    }
  }

  const getServiceStatus = (interval) => {
    if (!vehicle.current_mileage || !interval.next_due_mileage) return 'unknown'
    const diff = interval.next_due_mileage - vehicle.current_mileage
    if (diff < 0) return 'overdue'
    if (diff < 500) return 'due-soon'
    return 'ok'
  }

  const STATUS_COLORS = { overdue: 'var(--danger)', 'due-soon': 'var(--accent)', ok: 'var(--safe)', unknown: 'var(--text-tertiary)' }
  const STATUS_LABELS = { overdue: 'OVERDUE', 'due-soon': 'DUE SOON', ok: 'OK', unknown: '—' }

  const BUILD_SECTIONS = [
    { key: 'drivetrain',   label: 'Engine & drivetrain', fields: ['engine','transmission','transfer_case','front_axle','rear_axle','lockers','gear_ratio'] },
    { key: 'suspension',   label: 'Suspension',          fields: ['lift_height','lift_brand','shocks','springs','UCAs'] },
    { key: 'wheels_tires', label: 'Wheels & tires',      fields: ['tire_brand','tire_model','tire_size','wheel_brand','wheel_size','wheel_offset'] },
    { key: 'armor',        label: 'Armor & protection',  fields: ['front_bumper','rear_bumper','sliders','skid_plates','tire_carrier'] },
    { key: 'recovery',     label: 'Recovery',            fields: ['winch_brand','winch_rating','recovery_boards','hi_lift','kinetic_rope','shackles'] },
    { key: 'camping',      label: 'Camping & sleeping',  fields: ['sleeping','awning','kitchen','storage','water'] },
    { key: 'electrical',   label: 'Electrical & power',  fields: ['primary_battery','solar','alternator','compressor','switch_panel','inverter'] },
    { key: 'navigation',   label: 'Navigation & comms',  fields: ['gps','communication','dash_cam'] },
    { key: 'lighting',     label: 'Lighting',            fields: ['light_bar','driving_lights'] },
  ]

  const MOD_SUMMARY = [
    { key: 'suspension',   label: 'Suspension', getValue: d => d?.lift_height ? `${d.lift_height} lift${d.shocks ? ` · ${d.shocks}` : ''}` : null },
    { key: 'wheels_tires', label: 'Tires',      getValue: d => d?.tire_size ? `${d.tire_size} · ${d.tire_brand || ''} ${d.tire_model || ''}`.trim() : null },
    { key: 'recovery',     label: 'Recovery',   getValue: d => d?.winch_brand ? `${d.winch_brand} ${d.winch_rating || ''} winch`.trim() : null },
    { key: 'camping',      label: 'Camping',    getValue: d => d?.sleeping || null },
    { key: 'electrical',   label: 'Power',      getValue: d => d?.primary_battery || null },
  ]

  return (
    <div style={pageWrap}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <button onClick={onBack} style={backBtn}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
              {vehicle.nickname || `${vehicle.year} ${vehicle.make}`}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}>
              {[vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ')}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ id: 'overview', label: 'Overview' }, { id: 'build', label: 'Build sheet' }, { id: 'maintenance', label: 'Maintenance' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '5px 12px', borderRadius: 16, border: `1px solid ${tab === t.id ? 'var(--accent)' : 'var(--border)'}`, background: tab === t.id ? 'rgba(196,82,26,0.12)' : 'transparent', color: tab === t.id ? 'var(--accent)' : 'var(--text-tertiary)', fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {/* ── Overview ── */}
        {tab === 'overview' && (
          <div>
            <div onClick={() => photoInputRef.current?.click()}
              style={{ width: '100%', height: 200, borderRadius: 14, background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer', marginBottom: 16, position: 'relative' }}>
              {vehicle.photo_url ? (
                <>
                  <img src={vehicle.photo_url} alt={vehicle.nickname} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.6)', borderRadius: 6, padding: '3px 8px', fontSize: 10, fontFamily: 'var(--font-mono)', color: '#fff' }}>
                    {uploading ? 'Uploading...' : 'Tap to change'}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 32, height: 32, marginBottom: 8 }}>
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  <div style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--font-body)' }}>{uploading ? 'Uploading...' : 'Add rig photo'}</div>
                </div>
              )}
            </div>
            <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'Mileage',      value: vehicle.current_mileage ? `${vehicle.current_mileage.toLocaleString()} mi` : '—' },
                { label: 'Color',        value: vehicle.color || '—' },
                { label: 'Transmission', value: vehicle.drivetrain?.transmission || '—' },
                { label: 'Engine',       value: vehicle.drivetrain?.engine || '—' },
              ].map((s, i) => (
                <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>{s.value}</div>
                </div>
              ))}
            </div>

            {MOD_SUMMARY.filter(s => s.getValue(vehicle[s.key])).map((s, i) => (
              <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 80 }}>{s.label}</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', textAlign: 'right', flex: 1, marginLeft: 12 }}>{s.getValue(vehicle[s.key])}</div>
              </div>
            ))}

            {vehicle.vin && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginTop: 8 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>VIN</div>
                <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>{vehicle.vin}</div>
              </div>
            )}

            <button onClick={() => { if (confirm(`Remove ${vehicle.nickname || vehicle.make} from fleet?`)) onDelete(vehicle.id) }}
              style={{ marginTop: 24, width: '100%', padding: 10, borderRadius: 8, border: '1px solid color-mix(in srgb, var(--danger) 40%, transparent)', background: 'transparent', color: 'var(--danger)', fontSize: 13, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
              Remove from fleet
            </button>
          </div>
        )}

        {/* ── Build Sheet ── */}
        {tab === 'build' && (
          <div>
            {BUILD_SECTIONS.map(section => {
              const data = vehicle[section.key] || {}
              const populated = section.fields.filter(f => data[f])
              return (
                <div key={section.key} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{section.label}</div>
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                    {populated.length === 0 ? (
                      <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', fontStyle: 'italic' }}>Not specified</div>
                    ) : populated.map((field, i) => (
                      <div key={field} style={{ padding: '10px 14px', borderBottom: i < populated.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'capitalize', flexShrink: 0 }}>{field.replace(/_/g, ' ')}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', textAlign: 'right' }}>{data[field]}</div>
                      </div>
                    ))}
                    {data.notes && (
                      <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', fontStyle: 'italic' }}>{data.notes}</div>
                    )}
                  </div>
                </div>
              )
            })}
            {(vehicle.other_mods?.items ?? []).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Other mods</div>
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                  {vehicle.other_mods.items.map((item, i, arr) => (
                    <div key={i} style={{ padding: '10px 14px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>{item}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Maintenance ── */}
        {tab === 'maintenance' && (
          <div>
            {loadingMaint ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : (
              <>
                {intervals.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Service intervals</div>
                    {intervals.map(iv => {
                      const status = getServiceStatus(iv)
                      return (
                        <div key={iv.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>{iv.service_type}</div>
                            {iv.next_due_mileage && (
                              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>Due at {iv.next_due_mileage.toLocaleString()} mi</div>
                            )}
                          </div>
                          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: STATUS_COLORS[status], letterSpacing: '0.06em' }}>{STATUS_LABELS[status]}</div>
                        </div>
                      )
                    })}
                  </div>
                )}

                <AddServiceInterval vehicleId={vehicle.id} userId={user.id} currentMileage={vehicle.current_mileage} onAdd={loadMaintenance} />

                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                    Service history · {maintenanceLog.length} entries
                  </div>
                  {maintenanceLog.length === 0 ? (
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', fontStyle: 'italic' }}>No service history yet</div>
                  ) : maintenanceLog.map(entry => (
                    <div key={entry.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>{entry.service_type}</div>
                        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                          {new Date(entry.performed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 16 }}>
                        {entry.mileage && <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{entry.mileage.toLocaleString()} mi</div>}
                        {entry.cost && <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>${entry.cost}</div>}
                        {entry.shop && <div style={{ fontSize: 11, fontFamily: 'var(--font-body)', color: 'var(--text-tertiary)' }}>{entry.shop}</div>}
                      </div>
                      {entry.notes && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', marginTop: 4, fontStyle: 'italic' }}>{entry.notes}</div>}
                    </div>
                  ))}
                  <AddMaintenanceEntry vehicleId={vehicle.id} userId={user.id} currentMileage={vehicle.current_mileage} onAdd={loadMaintenance} intervals={intervals} />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Add Service Interval ──────────────────────────────────────────────────────

const DEFAULT_INTERVALS = [
  { label: 'Oil change',           miles: 5000,  months: 6 },
  { label: 'Tire rotation',        miles: 5000 },
  { label: 'Air filter',           miles: 15000 },
  { label: 'Differential fluid',   miles: 30000 },
  { label: 'Transfer case fluid',  miles: 30000 },
  { label: 'Spark plugs',          miles: 30000 },
  { label: 'Coolant flush',        miles: 50000, months: 24 },
  { label: 'Transmission fluid',   miles: 30000 },
  { label: 'Brake fluid',          months: 24 },
  { label: 'Custom...' },
]

function AddServiceInterval({ vehicleId, userId, currentMileage, onAdd }) {
  const [open, setOpen]             = useState(false)
  const [serviceType, setServiceType] = useState('')
  const [intervalMiles, setIntervalMiles] = useState('')
  const [intervalMonths, setIntervalMonths] = useState('')
  const [lastMileage, setLastMileage] = useState('')
  const [saving, setSaving]         = useState(false)

  const handleSave = async () => {
    if (!serviceType.trim()) return
    setSaving(true)
    try {
      const lastMi = parseInt(lastMileage) || currentMileage || 0
      const intMi  = parseInt(intervalMiles) || null
      await supabase.from('service_intervals').insert({
        vehicle_id: vehicleId, user_id: userId,
        service_type: serviceType,
        interval_miles: intMi,
        interval_months: parseInt(intervalMonths) || null,
        last_done_mileage: lastMi,
        last_done_date: new Date().toISOString().split('T')[0],
        next_due_mileage: intMi ? lastMi + intMi : null,
        is_active: true,
      })
      setOpen(false); setServiceType(''); setIntervalMiles(''); setIntervalMonths(''); setLastMileage('')
      onAdd()
    } catch (err) { console.error('Add interval error:', err) }
    finally { setSaving(false) }
  }

  if (!open) {
    return <button onClick={() => setOpen(true)} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--accent)', fontSize: 13, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>+ Add service interval</button>
  }

  const rowInput = (value, onChange, placeholder, type = 'text') => (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type={type} style={{ ...inputStyle, marginBottom: 6 }} />
  )

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--accent)', borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', marginBottom: 10 }}>Add service interval</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {DEFAULT_INTERVALS.map(d => (
          <button key={d.label} onClick={() => { setServiceType(d.label === 'Custom...' ? '' : d.label); setIntervalMiles(d.miles?.toString() || ''); setIntervalMonths(d.months?.toString() || '') }}
            style={{ padding: '4px 10px', borderRadius: 16, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-tertiary)', fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
            {d.label}
          </button>
        ))}
      </div>
      {rowInput(serviceType, setServiceType, 'Service type')}
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <input value={intervalMiles} onChange={e => setIntervalMiles(e.target.value)} placeholder="Every X miles" type="number" style={{ flex: 1, ...inputStyle, marginBottom: 0 }} />
        <input value={intervalMonths} onChange={e => setIntervalMonths(e.target.value)} placeholder="Every X months" type="number" style={{ flex: 1, ...inputStyle, marginBottom: 0 }} />
      </div>
      {rowInput(lastMileage, setLastMileage, `Last done at mileage (current: ${currentMileage?.toLocaleString() || '?'})`, 'number')}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={() => setOpen(false)} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>Cancel</button>
        <button onClick={handleSave} disabled={!serviceType.trim() || saving} style={{ flex: 2, padding: 8, borderRadius: 8, border: 'none', background: serviceType.trim() ? 'var(--accent)' : 'var(--border)', color: serviceType.trim() ? '#fff' : 'var(--text-tertiary)', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: serviceType.trim() ? 'pointer' : 'default' }}>
          {saving ? 'Saving...' : 'Add interval'}
        </button>
      </div>
    </div>
  )
}

// ─── Add Maintenance Entry ─────────────────────────────────────────────────────

function AddMaintenanceEntry({ vehicleId, userId, currentMileage, onAdd, intervals }) {
  const [open, setOpen]           = useState(false)
  const [serviceType, setServiceType] = useState('')
  const [mileage, setMileage]     = useState(currentMileage?.toString() || '')
  const [cost, setCost]           = useState('')
  const [shop, setShop]           = useState('')
  const [notes, setNotes]         = useState('')
  const [date, setDate]           = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving]       = useState(false)

  const handleSave = async () => {
    if (!serviceType.trim()) return
    setSaving(true)
    try {
      const mi = parseInt(mileage) || null
      const matchingInterval = intervals.find(i => i.service_type === serviceType)
      await supabase.from('maintenance_log').insert({
        vehicle_id: vehicleId, user_id: userId,
        service_type: serviceType, mileage: mi,
        cost: parseFloat(cost) || null,
        shop: shop.trim() || null,
        notes: notes.trim() || null,
        performed_at: date,
        next_due_mileage: matchingInterval?.interval_miles && mi ? mi + matchingInterval.interval_miles : null,
      })
      if (matchingInterval) {
        await supabase.from('service_intervals').update({
          last_done_mileage: mi, last_done_date: date,
          next_due_mileage: matchingInterval.interval_miles && mi ? mi + matchingInterval.interval_miles : matchingInterval.next_due_mileage,
          updated_at: new Date().toISOString(),
        }).eq('id', matchingInterval.id)
      }
      setOpen(false); setServiceType(''); setMileage(currentMileage?.toString() || ''); setCost(''); setShop(''); setNotes('')
      onAdd()
    } catch (err) { console.error('Add maintenance error:', err) }
    finally { setSaving(false) }
  }

  if (!open) {
    return <button onClick={() => setOpen(true)} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--accent)', fontSize: 13, fontFamily: 'var(--font-body)', cursor: 'pointer', marginTop: 8 }}>+ Log service</button>
  }

  const fi = (value, onChange, placeholder, type = 'text', extraStyle = {}) => (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type={type} style={{ ...inputStyle, marginBottom: 6, ...extraStyle }} />
  )

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--accent)', borderRadius: 12, padding: 14, marginTop: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', marginBottom: 10 }}>Log service</div>
      {intervals.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {intervals.map(iv => (
            <button key={iv.id} onClick={() => setServiceType(iv.service_type)}
              style={{ padding: '3px 8px', borderRadius: 12, border: `1px solid ${serviceType === iv.service_type ? 'var(--accent)' : 'var(--border)'}`, background: serviceType === iv.service_type ? 'rgba(196,82,26,0.12)' : 'transparent', color: serviceType === iv.service_type ? 'var(--accent)' : 'var(--text-tertiary)', fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
              {iv.service_type}
            </button>
          ))}
        </div>
      )}
      {fi(serviceType, setServiceType, 'Service type')}
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <input value={mileage} onChange={e => setMileage(e.target.value)} placeholder="Mileage" type="number" style={{ flex: 1, ...inputStyle, marginBottom: 0 }} />
        <input value={cost} onChange={e => setCost(e.target.value)} placeholder="Cost $" type="number" style={{ flex: 1, ...inputStyle, marginBottom: 0 }} />
      </div>
      {fi(date, setDate, '', 'date')}
      {fi(shop, setShop, 'Shop or DIY')}
      <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2}
        style={{ ...inputStyle, resize: 'none', marginBottom: 10 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setOpen(false)} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>Cancel</button>
        <button onClick={handleSave} disabled={!serviceType.trim() || saving} style={{ flex: 2, padding: 8, borderRadius: 8, border: 'none', background: serviceType.trim() ? 'var(--accent)' : 'var(--border)', color: serviceType.trim() ? '#fff' : 'var(--text-tertiary)', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: serviceType.trim() ? 'pointer' : 'default' }}>
          {saving ? 'Saving...' : 'Log service'}
        </button>
      </div>
    </div>
  )
}

// ─── Main FleetPage ────────────────────────────────────────────────────────────

export default function FleetPage({ onBack }) {
  const { user, isPro } = useAppStore()
  const { vehicles, loading, canAddVehicle, addVehicle, updateVehicle, deleteVehicle } = useFleet()
  const [view, setView]                   = useState('roster')
  const [selectedVehicle, setSelectedVehicle] = useState(null)

  const handleSetupComplete = async (data) => {
    console.log('[Fleet] Saving vehicle:', data)
    try {
      const saved = await addVehicle(data)
      console.log('[Fleet] Vehicle saved:', saved)
      setView('roster')
    } catch (err) {
      console.error('[Fleet] Add vehicle error:', err)
    }
  }

  return (
    <div style={pageWrap}>
      {view === 'roster' && (
        <>
          <div style={{ ...headerStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={onBack} style={backBtn}>←</button>
              <div>
                <div style={monoLabel}>Fleet</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                  {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}{!isPro ? ' · Free plan' : ''}
                </div>
              </div>
            </div>
            {canAddVehicle() && (
              <button onClick={() => setView('setup')} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '6px 14px', color: '#fff', fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
                + Add rig
              </button>
            )}
          </div>
          <FleetRoster
            vehicles={vehicles} loading={loading} isPro={isPro}
            canAddVehicle={canAddVehicle}
            onAdd={() => setView('setup')}
            onSelect={v => { setSelectedVehicle(v); setView('detail') }}
            user={user}
          />
        </>
      )}

      {view === 'setup' && (
        <VehicleSetupChat onComplete={handleSetupComplete} onCancel={() => setView('roster')} />
      )}

      {view === 'detail' && selectedVehicle && (
        <VehicleDetail
          vehicle={selectedVehicle}
          onBack={() => { setSelectedVehicle(null); setView('roster') }}
          onUpdate={async (id, updates) => {
            const updated = await updateVehicle(id, updates)
            setSelectedVehicle(updated)
          }}
          onDelete={async (id) => {
            await deleteVehicle(id)
            setSelectedVehicle(null)
            setView('roster')
          }}
          user={user}
        />
      )}
    </div>
  )
}
