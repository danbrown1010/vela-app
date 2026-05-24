import { useState, useRef, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useFireData } from '../hooks/useFireData'
import { useTripDocs } from '../hooks/useTripDocs'
import { useAppStore } from '../store/index'
import { getGearSummary } from '../utils/gearStorage'
import { ProGate } from '../components/ProGate'
import { getAnthropicKey } from '../utils/secretsManager'
import { IconMapPin, IconThermometer, IconWind, IconFlame, IconTent, IconArrowLeft, IconSend } from '../components/icons'
import distance from '@turf/distance'
import { point } from '@turf/helpers'

// ─── Markdown renderer ────────────────────────────────────────────────────────

function formatInline(raw) {
  return raw
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:rgba(0,0,0,0.15);padding:1px 5px;border-radius:3px;font-family:var(--font-mono);font-size:11px">$1</code>')
}

function renderMarkdown(text) {
  const lines = text.split('\n')
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
          {items.map((item, j) => (
            <li key={j} style={{ lineHeight: 1.55 }}
              dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
          ))}
        </ul>
      )
      continue
    }

    result.push(
      <p key={`p-${i}`} style={{ margin: '3px 0', lineHeight: 1.55 }}
        dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
    )
    i++
  }
  return result
}

// ─── AQI chip color ───────────────────────────────────────────────────────────

function aqiColors(category) {
  const c = (category ?? '').toLowerCase()
  if (c.includes('good'))      return { bg: 'rgba(34,197,94,0.12)',  color: '#22c55e', border: 'rgba(34,197,94,0.3)' }
  if (c.includes('moderate'))  return { bg: 'rgba(234,179,8,0.15)',  color: '#eab308', border: 'rgba(234,179,8,0.3)' }
  if (c.includes('sensitive')) return { bg: 'rgba(249,115,22,0.15)', color: '#f97316', border: 'rgba(249,115,22,0.3)' }
  if (c.includes('unhealthy')) return { bg: 'rgba(239,68,68,0.15)',  color: '#ef4444', border: 'rgba(239,68,68,0.3)' }
  if (c.includes('very'))      return { bg: 'rgba(168,85,247,0.15)', color: '#a855f7', border: 'rgba(168,85,247,0.3)' }
  if (c.includes('hazard'))    return { bg: 'rgba(127,29,29,0.25)',  color: '#f87171', border: 'rgba(239,68,68,0.4)' }
  return { bg: 'var(--bg-card)', color: 'var(--text-secondary)', border: 'var(--border)' }
}

// ─── Constants ────────────────────────────────────────────────────────────────

function buildDocContext(docs, tripDocs) {
  let context = ''

  if (tripDocs.length > 0) {
    context += `DOCUMENTS ATTACHED TO ACTIVE TRIP (${tripDocs.length} total):\n`
    tripDocs.forEach(doc => {
      context += `- "${doc.title}" [${doc.category || doc.type}]`
      if (doc.metadata?.confirmation) context += ` · Confirmation: ${doc.metadata.confirmation}`
      if (doc.metadata?.location)     context += ` · Location: ${doc.metadata.location}`
      if (doc.content)                context += `\n  Content: ${doc.content.slice(0, 300)}`
      else if (doc.extracted_text)    context += `\n  Extracted: ${doc.extracted_text.slice(0, 300)}`
      context += '\n'
    })
  }

  if (docs.length > 0) {
    context += `\nALL GLOVE BOX DOCUMENTS (${docs.length} total, secret documents excluded):\n`
    docs.forEach(doc => {
      context += `- "${doc.title}" [${doc.category || doc.type}]`
      if (doc.metadata?.confirmation) context += ` · Confirmation: ${doc.metadata.confirmation}`
      if (doc.tags?.length)           context += ` · Tags: ${doc.tags.join(', ')}`
      context += '\n'
    })
  }

  if (!context) return null

  return context + `\nNote: For text notes you have full content above. For files (PDFs/images) you have metadata only — ask the user to share the content if needed. Secret documents are never shown here.`
}

const SUGGESTIONS = [
  "Water source looks questionable — how do I treat it?",
  "Signs of altitude sickness in my group",
  "Recovery options if I'm high-centered",
  "Fire 15 miles away — should I be concerned?",
]

const INITIAL_MESSAGES = [
  {
    role: 'assistant',
    content: `VELA Survival Agent online.\n\nI have your current location, weather, and air quality. Ask me anything about your situation — recovery, navigation, first aid, fire behavior, water, or mechanical issues.\n\nWhat do you need?`,
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SurvivalAgentPage({ onBack }) {
  const { location, weather, aqi, activeTrip, user } = useAppStore()
  const { fires } = useFireData()
  const { docs: tripDocs } = useTripDocs(activeTrip?.id, user?.id)

  const [messages, setMessages]       = useState(INITIAL_MESSAGES)
  const [input, setInput]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [gearSummary, setGearSummary] = useState(null)
  const [apiKey, setApiKey]           = useState(null)
  const [docContext, setDocContext]    = useState([])
  const [docsLoaded, setDocsLoaded]   = useState(false)
  const docContextRef                 = useRef([])
  const messagesEndRef = useRef(null)
  const inputRef       = useRef(null)

  useEffect(() => { getGearSummary().then(setGearSummary) }, [])
  useEffect(() => { getAnthropicKey(user?.id).then(setApiKey) }, [user?.id])
  useEffect(() => {
    if (!user?.id) { setDocsLoaded(true); return }
    supabase
      .from('glove_box')
      .select('id, title, type, category, content, tags, metadata, extracted_text')
      .eq('user_id', user.id)
      .eq('is_secret', false)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (error) console.warn('[SurvivalAgent] Doc context load failed:', error)
        const docs = data ?? []
        docContextRef.current = docs
        setDocContext(docs)
        setDocsLoaded(true)
      })
  }, [user?.id])

  const hasUserMessage = messages.some(m => m.role === 'user')

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const nearbyFires = useMemo(() => {
    if (!fires?.features?.length || !location) return []
    const userPt = point([location.lng, location.lat])
    return fires.features
      .map(f => {
        const geom = f.geometry
        if (!geom) return null
        let coord
        if (geom.type === 'Polygon')           coord = geom.coordinates[0]?.[0]
        else if (geom.type === 'MultiPolygon') coord = geom.coordinates[0]?.[0]?.[0]
        if (!coord) return null
        const mi = Math.round(distance(userPt, point(coord), { units: 'miles' }))
        if (mi > 100) return null
        return { name: f.properties?.IncidentName ?? 'Unknown', acres: Math.round(f.properties?.GISAcres ?? 0), mi }
      })
      .filter(Boolean)
      .sort((a, b) => a.mi - b.mi)
  }, [fires, location])

  const buildSystemPrompt = () => {
    const parts = [
      `You are VELA's Survival Agent — a wilderness expert and expedition advisor for overlanders, off-road travelers, and backcountry campers.

You are direct, practical, and calm under pressure. You prioritize safety without being alarmist. You give actionable advice specific to the user's situation.

Current situational context:`,
    ]
    if (location)
      parts.push(`Location: ${location.lat.toFixed(4)}°N, ${Math.abs(location.lng).toFixed(4)}°W\nAccuracy: ±${Math.round(location.accuracy)}m`)
    if (weather)
      parts.push(`Weather: ${weather.temperature}°${weather.temperatureUnit}, ${weather.shortForecast}\nWind: ${weather.windSpeed} ${weather.windDirection}`)
    if (aqi)
      parts.push(`Air quality: AQI ${aqi.aqi} — ${aqi.category}\nPrimary pollutant: ${aqi.pollutant}`)
    if (nearbyFires.length > 0)
      parts.push(`Active fires within 100mi:\n${nearbyFires.slice(0, 3).map(f => `  • ${f.name} — ${f.mi}mi away, ${f.acres.toLocaleString()} acres`).join('\n')}`)
    if (activeTrip)
      parts.push(`Active trip: ${activeTrip.name}\nDates: ${activeTrip.departureDate} to ${activeTrip.returnDate}\nRegion: ${activeTrip.region ?? 'Unknown'}`)
    if (gearSummary)
      parts.push(gearSummary)
    else
      parts.push('Equipment: No gear registry configured yet.')
    const docCtx = buildDocContext(docContextRef.current, tripDocs)
    if (docCtx) parts.push(docCtx)
    parts.push(`Expertise areas:
- Vehicle recovery (winching, traction boards, high-lift jack, kinetic rope)
- Navigation and route-finding
- Wilderness first aid and emergency response
- Fire behavior, evacuation decisions, smoke and AQI effects
- Water sourcing and purification
- Camp setup, bear safety, wildlife
- Weather interpretation for backcountry
- Mechanical diagnosis for 4x4 vehicles
- Communication when off-grid (Starlink, satellite communicators, radio)
- Leave No Trace and land access

Vehicle: 2014 Jeep JKU Wrangler Unlimited
Build: Ursa Minor camper top, Dana 44 axles, NV241OR transfer case, aftermarket suspension.

Keep responses concise and scannable. Use short paragraphs. Lead with the most critical information. If situation is dangerous, say so clearly at the top. Use bullet points for multi-step procedures.`)
    return parts.join('\n\n')
  }

  const sendMessage = async (override) => {
    const content = (override ?? input).trim()
    if (!content || loading || !docsLoaded) return

    if (!apiKey) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'No API key configured. Go to **Settings → AI Configuration** to add your Anthropic API key.',
      }])
      return
    }

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
          model: 'claude-sonnet-4-5',
          max_tokens: 1024,
          system: buildSystemPrompt(),
          messages: next.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error.message)
      const reply = data.content?.[0]?.text ?? 'No response received.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Connection error: ${err.message}. Check your network and try again.`,
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const chipBase = {
    fontSize: 11, padding: '3px 8px', borderRadius: 12,
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)',
    whiteSpace: 'nowrap', flexShrink: 0,
  }
  const aqiStyle = aqi ? aqiColors(aqi.category) : null

  return (
    <ProGate feature="Survival Agent">
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)' }}>

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px 8px' }}>
          <button
            onClick={onBack}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              border: '1px solid var(--border)', background: 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <IconArrowLeft style={{ width: 16, height: 16, color: 'var(--text-secondary)' }} />
          </button>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.08em', margin: 0 }}>
              SURVIVAL AGENT
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.06em', margin: '2px 0 0' }}>
              POWERED BY CLAUDE · VELA AI
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#22c55e', letterSpacing: '0.06em' }}>ONLINE</span>
          </div>
        </div>

        {/* Context chips */}
        <div style={{ display: 'flex', gap: 6, padding: '0 16px 10px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {location && (
            <div style={{ ...chipBase, display: 'flex', alignItems: 'center', gap: 4 }}>
              <IconMapPin style={{ width: 11, height: 11, flexShrink: 0 }} />
              {location.lat.toFixed(4)}°N {Math.abs(location.lng).toFixed(4)}°W
            </div>
          )}
          {weather && (
            <div style={{ ...chipBase, display: 'flex', alignItems: 'center', gap: 4 }}>
              <IconThermometer style={{ width: 11, height: 11, flexShrink: 0 }} />
              {weather.temperature}°{weather.temperatureUnit} · {weather.shortForecast}
            </div>
          )}
          {aqi && aqiStyle && (
            <div style={{ ...chipBase, background: aqiStyle.bg, color: aqiStyle.color, border: `1px solid ${aqiStyle.border}`, display: 'flex', alignItems: 'center', gap: 4 }}>
              <IconWind style={{ width: 11, height: 11, flexShrink: 0 }} />
              AQI {aqi.aqi} · {aqi.category}
            </div>
          )}
          {nearbyFires.length > 0 && (
            <div style={{ ...chipBase, background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <IconFlame style={{ width: 11, height: 11, flexShrink: 0 }} />
              {nearbyFires[0].name} · {nearbyFires[0].mi}mi
            </div>
          )}
          {activeTrip && (
            <div style={{ ...chipBase, display: 'flex', alignItems: 'center', gap: 4 }}>
              <IconTent style={{ width: 11, height: 11, flexShrink: 0 }} />
              {activeTrip.name}
            </div>
          )}
          {docContext.length > 0 && (
            <div style={{ ...chipBase, display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
                strokeLinecap="round" strokeLinejoin="round" style={{ width: 11, height: 11, flexShrink: 0 }}>
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
              </svg>
              {docContext.length} doc{docContext.length !== 1 ? 's' : ''}
            </div>
          )}
          {!location && !weather && !aqi && (
            <div style={{ ...chipBase, color: 'var(--text-tertiary)' }}>Acquiring context…</div>
          )}
        </div>
      </div>

      {/* ─── Messages ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: msg.role === 'user' ? '80%' : '85%',
              padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-card)',
              border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
              color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
            }}>
              {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '12px 16px', borderRadius: '16px 16px 16px 4px',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              display: 'flex', gap: 5, alignItems: 'center',
            }}>
              {[0, 1, 2].map(j => (
                <div key={j} style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: 'var(--text-tertiary)',
                  animation: 'pulse 1s ease-in-out infinite',
                  animationDelay: `${j * 0.18}s`,
                }} />
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ─── Suggestions ────────────────────────────────────────────────── */}
      {!hasUserMessage && docsLoaded && (
        <div style={{
          display: 'flex', gap: 8, padding: '6px 16px 8px',
          overflowX: 'auto', scrollbarWidth: 'none',
          background: 'var(--bg-primary)', flexShrink: 0,
        }}>
          {SUGGESTIONS.map((s, i) => (
            <button key={i} onClick={() => sendMessage(s)} style={{
              flexShrink: 0, fontSize: 12, padding: '7px 12px', borderRadius: 16,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', fontFamily: 'var(--font-body)',
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ─── Input bar ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 8, padding: '10px 16px',
        paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
        background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder={docsLoaded ? 'Ask anything...' : 'Loading context…'}
          disabled={!docsLoaded}
          style={{
            flex: 1, background: 'var(--bg-card)',
            border: '1px solid var(--border)', borderRadius: 20,
            padding: '10px 16px', color: 'var(--text-primary)',
            fontFamily: 'var(--font-body)', fontSize: 14, outline: 'none',
            opacity: docsLoaded ? 1 : 0.5,
          }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading || !docsLoaded}
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: input.trim() && !loading && docsLoaded ? 'var(--accent)' : 'var(--bg-card)',
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: input.trim() && !loading && docsLoaded ? 'pointer' : 'default',
            flexShrink: 0, transition: 'background 0.15s',
          }}
        >
          <IconSend style={{ width: 16, height: 16 }} />
        </button>
      </div>
    </div>
    </ProGate>
  )
}
