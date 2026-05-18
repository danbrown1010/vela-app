import { useState, useEffect } from 'react'
import { IconSun, IconPlugZap, IconZap, IconCar, IconUsb, IconRefresh } from '../components/icons'
import { useAppStore } from '../store/index'
import { useFleet } from '../hooks/useFleet'
import { supabase } from '../lib/supabase'
import { useEcoFlow } from '../hooks/useEcoFlow'
import { ECOFLOW_DEVICES } from '../config/devices'
import { StatusBadge } from '../components/StatusBadge'
import { Skeleton } from '../components/Skeleton'
import { GpsStatus } from '../components/GpsStatus'
import HomeAssistantCard from '../components/HomeAssistantCard'
import { CommunicationsSection } from './CommunicationsSection'

// ─── Seed data ────────────────────────────────────────────────────────────────

const HAS_ALERT = false

const TEMP_ZONES = [
  { id: 'outside',  label: 'Outside',     value: 54, unit: '°F', color: '#60a5fa' },
  { id: 'cabin',    label: 'Cabin',        value: 68, unit: '°F', color: '#f97316' },
  { id: 'ursa',     label: 'Ursa Minor',   value: 62, unit: '°F', color: null },
  { id: 'fridge',   label: 'Fridge',       value: 38, unit: '°F', color: '#4ade80' },
  { id: 'battery',  label: 'Battery comp', value: 72, unit: '°F', color: null },
  { id: 'water',    label: 'Water tank',   value: 55, unit: '°F', color: null },
]


const HUMIDITY_ZONES = [
  { id: 'cabin', label: 'Cabin',      value: 45 },
  { id: 'ursa',  label: 'Ursa Minor', value: 52 },
]

const INITIAL_LIGHTS = {
  interior: { on: true,  brightness: 80  },
  cabin:    { on: false, brightness: 50  },
  rock:     { on: false, brightness: 100 },
  camp:     { on: true,  brightness: 60  },
  bed:      { on: true,  brightness: 100 },
}

const LIGHT_LABELS = {
  interior: 'Interior',
  cabin:    'Cabin dome',
  rock:     'Rock lights',
  camp:     'Camp flood',
  bed:      'Bed reading',
}

const SCENES = {
  'Arrive at camp': { interior: { on: true, brightness: 100 }, cabin: { on: true, brightness: 80 }, rock: { on: true, brightness: 60 }, camp: { on: true, brightness: 100 }, bed: { on: false } },
  'Cooking':        { interior: { on: true, brightness: 80  }, cabin: { on: true, brightness: 60 }, rock: { on: false },                camp: { on: true, brightness: 100 }, bed: { on: false } },
  'Stargazing':     { interior: { on: false }, cabin: { on: false }, rock: { on: false }, camp: { on: false }, bed: { on: false } },
  'Photography':    { interior: { on: true, brightness: 40  }, cabin: { on: false },               rock: { on: true, brightness: 100 }, camp: { on: true, brightness: 80  }, bed: { on: false } },
  'Wake up':        { interior: { on: true, brightness: 30  }, cabin: { on: true, brightness: 20 }, rock: { on: false },               camp: { on: false },                  bed: { on: true, brightness: 60 } },
  'Depart':         { interior: { on: false }, cabin: { on: false }, rock: { on: false }, camp: { on: false }, bed: { on: false } },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RigPage() {
  const [lights, setLights] = useState(INITIAL_LIGHTS)
  const [ecoInfo, setEcoInfo] = useState(null)
  const currentDevice = ecoInfo?.device
  const batteryData = ecoInfo?.data

  const { vehicles } = useFleet()
  const primaryVehicle = vehicles.find(v => v.is_primary) ?? vehicles[0] ?? null

  const [integrations, setIntegrations] = useState({ ecoflow: true, starlink: true, home_assistant: false })
  useEffect(() => {
    if (primaryVehicle?.integrations) setIntegrations(primaryVehicle.integrations)
  }, [primaryVehicle?.id])

  const toggleIntegration = async (key) => {
    const updated = { ...integrations, [key]: !integrations[key] }
    setIntegrations(updated)
    if (primaryVehicle) {
      await supabase.from('vehicles').update({ integrations: updated, updated_at: new Date().toISOString() }).eq('id', primaryVehicle.id)
    }
  }

  const [activeIntegration, setActiveIntegration] = useState(() =>
    ['ecoflow', 'starlink', 'home_assistant'].find(k => integrations[k]) ?? 'ecoflow'
  )
  const selectIntegration = (key) => {
    if (!integrations[key]) toggleIntegration(key)
    setActiveIntegration(key)
  }
  const { accent } = useAppStore()

  const toggleLight = (id) =>
    setLights(prev => ({ ...prev, [id]: { ...prev[id], on: !prev[id].on } }))

  const setBrightness = (id, val) =>
    setLights(prev => ({ ...prev, [id]: { ...prev[id], brightness: val } }))

  const applyScene = (sceneName) => {
    const scene = SCENES[sceneName]
    setLights(prev => {
      const next = { ...prev }
      for (const [id, cfg] of Object.entries(scene)) {
        next[id] = {
          on: cfg.on,
          brightness: cfg.on ? cfg.brightness : prev[id].brightness,
        }
      }
      return next
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Primary vehicle header */}
      {primaryVehicle && (
        <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '14px 16px', paddingRight: 48, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {primaryVehicle.photo_url ? (
              <img src={primaryVehicle.photo_url} alt={primaryVehicle.nickname} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
                <rect x="1" y="3" width="15" height="13" rx="2"/>
                <path d="M16 8h4l3 3v5h-7V8z"/>
                <circle cx="5.5" cy="18.5" r="2.5"/>
                <circle cx="18.5" cy="18.5" r="2.5"/>
              </svg>
            )}
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2, flexShrink: 0, textTransform: 'uppercase' }}>
              {primaryVehicle.nickname || primaryVehicle.make}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}>
              {[primaryVehicle.year, primaryVehicle.make, primaryVehicle.model, primaryVehicle.trim].filter(Boolean).join(' ')}
            </div>
          </div>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 8, padding: '2px 6px', letterSpacing: '0.06em', flexShrink: 0 }}>
            PRIMARY
          </div>
        </div>
        <GpsStatus />
        </div>
      )}

      {/* Integration selector chips */}
      {primaryVehicle && (
        <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', flexShrink: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {[
            { key: 'ecoflow',        label: 'Power'          },
            { key: 'starlink',       label: 'Communications' },
            { key: 'home_assistant', label: 'Environment'    },
          ].map(intg => {
            const isActive = activeIntegration === intg.key
            const isOn = integrations[intg.key]
            return (
              <button
                key={intg.key}
                onClick={() => selectIntegration(intg.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 14px', borderRadius: 20, flexShrink: 0,
                  border: `1px solid ${isActive ? `${accent}99` : 'var(--border)'}`,
                  background: isActive ? `${accent}22` : 'transparent',
                  color: isActive ? accent : 'var(--text-secondary)',
                  fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                  cursor: 'pointer',
                  transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, transition: 'background 0.2s', background: isOn ? '#22c55e' : 'var(--border)' }} />
                {intg.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Telemetry panel — driven by active integration */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="p-4 flex flex-col gap-5" style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
          {activeIntegration === 'ecoflow' && <EcoflowSection onShowInfo={setEcoInfo} />}
          {activeIntegration === 'starlink' && <CommunicationsSection />}
          {activeIntegration === 'home_assistant' && (
            <HomeAssistantCard />
          )}
        </div>
      </div>

      {ecoInfo && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setEcoInfo(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              zIndex: 100,
            }}
          />

          {/* Sheet */}
          <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'var(--bg-card)',
            borderRadius: '16px 16px 0 0',
            padding: '0 0 env(safe-area-inset-bottom)',
            zIndex: 101,
            maxHeight: '70vh',
            overflowY: 'auto',
          }}>
            {/* Drag handle */}
            <div style={{
              width: 36, height: 4,
              borderRadius: 2,
              background: 'var(--border)',
              margin: '12px auto 16px',
            }} />

            {/* Content */}
            <div style={{ padding: '0 20px 20px' }}>

              {/* Device name */}
              <div style={{
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: 4,
                fontFamily: 'var(--font-body)',
              }}>
                {currentDevice.name}
              </div>

              {/* Model */}
              <div style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                marginBottom: 16,
                fontFamily: 'var(--font-body)',
              }}>
                {currentDevice.model}
              </div>

              <div style={{ height: 1, background: 'var(--border)', marginBottom: 16 }} />

              {/* Info rows */}
              {[
                { label: 'Serial', value: currentDevice.sn, mono: true },
                currentDevice.capacity > 0 && {
                  label: 'Capacity',
                  value: `${currentDevice.capacity.toLocaleString()} Wh`,
                },
                currentDevice.capacity > 0 && batteryData?.soc != null && {
                  label: 'Current charge',
                  value: `${batteryData.soc}% · ${Math.round((batteryData.soc / 100) * currentDevice.capacity).toLocaleString()} Wh`,
                  color: batteryData.soc > 50 ? 'var(--safe)' : batteryData.soc > 20 ? 'var(--accent)' : 'var(--danger)',
                },
                currentDevice.capacity > 0 && batteryData?.cycles != null && {
                  label: 'Charge cycles',
                  value: batteryData.cycles,
                },
              ].filter(Boolean).map((row, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingBottom: 12,
                  marginBottom: 12,
                  borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
                    {row.label}
                  </div>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: row.color ?? 'var(--text-primary)',
                    fontFamily: row.mono ? 'var(--font-mono)' : 'var(--font-body)',
                    textAlign: 'right',
                    maxWidth: '60%',
                    wordBreak: 'break-all',
                  }}>
                    {row.value}
                  </div>
                </div>
              ))}

              <div style={{ height: 1, background: 'var(--border)', marginBottom: 16 }} />

              {/* Links */}
              {[
                { label: "Owner's Manual", url: currentDevice.manualUrl },
                { label: 'EcoFlow Support', url: 'https://www.ecoflow.com/us/support' },
              ].map((link, i) => (
                <div
                  key={i}
                  onClick={() => window.open(link.url, '_blank')}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 0',
                    borderBottom: i === 0 ? '1px solid var(--border)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 14, color: 'var(--accent)', fontFamily: 'var(--font-body)' }}>
                    {link.label}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>↗</div>
                </div>
              ))}

              {/* Close button */}
              <button
                onClick={() => setEcoInfo(null)}
                style={{
                  width: '100%',
                  marginTop: 16,
                  padding: '12px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: 14,
                  fontFamily: 'var(--font-body)',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Home Assistant status card ───────────────────────────────────────────────

function HomeAssistantSection({ vehicle, ha }) {
  const haUrl   = localStorage.getItem('vela-ha-url')   ?? ''
  const haToken = localStorage.getItem('vela-ha-token') ?? ''
  const isConfigured = haUrl && haToken

  if (!isConfigured) {
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', marginBottom: 6 }}>Home Assistant</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', lineHeight: 1.7 }}>
          Configure your HA URL and token in<br />Settings → Integrations → Home Assistant
        </div>
      </div>
    )
  }

  if (ha.loading && !ha.connected) {
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', marginBottom: 4 }}>Home Assistant</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}>Connecting to {haUrl}…</div>
      </div>
    )
  }

  if (ha.error) {
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>Home Assistant</div>
          <button
            onClick={ha.refetch}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px', fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
          >
            Retry
          </button>
        </div>
        <div style={{ fontSize: 12, color: '#f87171', fontFamily: 'var(--font-body)' }}>{ha.error}</div>
      </div>
    )
  }

  if (!ha.connected) return null

  const entityCount = ha.tempSensors.length + ha.humiditySensors.length + ha.lights.length + ha.scenes.length

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>Home Assistant</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            {vehicle?.nickname ? `${vehicle.nickname.toUpperCase()} WIFI NETWORK` : 'LOCAL NETWORK'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
          <button
            onClick={ha.refetch}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <IconRefresh style={{ width: 12, height: 12, color: 'var(--text-secondary)' }} />
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
        {[
          { label: 'Sensors', count: ha.tempSensors.length + ha.humiditySensors.length },
          { label: 'Lights',  count: ha.lights.length },
          { label: 'Scenes',  count: ha.scenes.length },
          { label: 'Total',   count: entityCount },
        ].map(item => (
          <div key={item.label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>{item.count}</div>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
          </div>
        ))}
      </div>
      {ha.lastUpdated && (
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 8, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
          Updated {ha.lastUpdated.toLocaleTimeString()}
        </div>
      )}
    </div>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────

function RigHeader({ hasAlert }) {
  return (
    <div style={{ paddingTop: 8, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.1 }}>Chomp</h1>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, letterSpacing: '0.06em' }}>2014 JEEP JKU · URSA MINOR</p>
      </div>
      <div style={{ marginTop: 4 }}>
        <StatusBadge status={hasAlert ? 'danger' : 'safe'} label={hasAlert ? '1 ALERT' : 'ALL OK'} />
      </div>
    </div>
  )
}

// ─── Temperature ──────────────────────────────────────────────────────────────

function TempZones({ haSensors = [] }) {
  const zones = haSensors.length > 0 ? haSensors : TEMP_ZONES
  const isHa = haSensors.length > 0
  return (
    <div>
      <SectionLabel>
        Temperature{isHa && <span style={{ fontSize: 9, color: 'var(--accent)', marginLeft: 6, fontFamily: 'var(--font-mono)', verticalAlign: 'middle' }}>● HA</span>}
      </SectionLabel>
      <div className="grid grid-cols-3 gap-2">
        {zones.map(z => (
          <div key={z.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 py-3">
            <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-1 leading-none">
              {z.label}
            </div>
            <div
              className={`text-lg font-bold leading-none${z.color ? '' : ' text-[var(--text-primary)]'}`}
              style={z.color ? { color: z.color } : undefined}
            >
              {z.value}{z.unit}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── EcoFlow ──────────────────────────────────────────────────────────────────

function formatRemainTime(minutes) {
  if (minutes == null || minutes <= 0) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function formatLastUpdated(date) {
  if (!date) return null
  const secs = Math.floor((Date.now() - date.getTime()) / 1000)
  if (secs < 15) return 'Updated just now'
  if (secs < 90) return `Updated ${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `Updated ${mins}min ago`
  return `Updated ${Math.floor(mins / 60)}h ago`
}

function EcoToast({ message }) {
  return (
    <div
      className="fixed left-0 right-0 flex justify-center z-[60] pointer-events-none"
      style={{ top: 'calc(env(safe-area-inset-top) + 16px)' }}
    >
      <div
        className="px-4 py-2 rounded-full text-sm font-medium text-[var(--text-primary)]"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
      >
        {message}
      </div>
    </div>
  )
}

function ChargingIndicator({ netFlow }) {
  const color = netFlow > 0 ? '#22c55e' : netFlow < 0 ? '#ef4444' : '#6b7280'
  const shouldPulse = netFlow !== 0

  return (
    <div style={{ position: 'relative', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {shouldPulse && (
        <div style={{ position: 'absolute', width: 24, height: 24, borderRadius: '50%', background: color, opacity: 0.2, animation: 'gps-pulse 2s ease-out infinite' }} />
      )}
      {shouldPulse && (
        <div style={{ position: 'absolute', width: 16, height: 16, borderRadius: '50%', background: color, opacity: 0.3, animation: 'gps-pulse 2s ease-out infinite', animationDelay: '0.4s' }} />
      )}
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, position: 'relative', zIndex: 1, boxShadow: shouldPulse ? `0 0 6px ${color}` : 'none' }} />
    </div>
  )
}

function PowerFlowCard({ type, data }) {
  const isIn = type === 'in'
  const accentColor = isIn ? '#22c55e' : '#f97316'

  const rows = isIn
    ? [
        {
          label: 'Solar',
          watts: data?.solarWatts ?? 0,
          icon: <IconSun style={{ width: 12, height: 12 }} />,
        },
        {
          label: 'AC Mains',
          watts: data?.acInputWatts ?? 0,
          icon: <IconPlugZap style={{ width: 12, height: 12 }} />,
        },
        {
          label: 'Alternator',
          watts: data?.alternatorWatts ?? 0,
          icon: <IconZap style={{ width: 12, height: 12 }} />,
        },
      ]
    : [
        {
          label: 'AC',
          watts: data?.acOutputWatts ?? 0,
          icon: <IconPlugZap style={{ width: 12, height: 12 }} />,
        },
        {
          label: 'DC 12V',
          watts: data?.dcOutputWatts ?? 0,
          icon: <IconCar style={{ width: 12, height: 12 }} />,
        },
        {
          label: 'USB',
          watts: data?.usbOutputWatts ?? 0,
          icon: <IconUsb style={{ width: 12, height: 12 }} />,
        },
      ]

  const total = isIn ? (data?.totalInputWatts ?? 0) : (data?.totalOutputWatts ?? 0)

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-2.5 flex flex-col gap-1">
      <div className="flex items-center justify-between mb-0.5 px-1">
        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: accentColor }}>
          {isIn ? 'IN' : 'OUT'}
        </span>
      </div>
      {rows.map(row => (
        <div
          key={row.label}
          className={`flex items-center gap-1.5 px-1.5 py-1 rounded-lg${row.watts > 0 ? ' bg-[var(--border)]' : ''}`}
        >
          <span style={{ color: row.watts > 0 ? accentColor : '#4b5563' }}>{row.icon}</span>
          <span className="text-[9px] text-[var(--text-secondary)] flex-1 leading-none">{row.label}</span>
          <span className={`text-[10px] font-semibold tabular-nums ${row.watts > 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
            {row.watts > 0 ? `${row.watts}W` : '—'}
          </span>
        </div>
      ))}
      <div className="flex justify-end px-1 pt-1 border-t border-[var(--border)] mt-0.5">
        <span
          className={`text-sm font-bold tabular-nums${total === 0 ? ' text-[var(--text-tertiary)]' : ''}`}
          style={total > 0 ? { color: accentColor } : undefined}
        >
          {total}W
        </span>
      </div>
    </div>
  )
}

function PortToggleRow({ icon, label, watts, enabled, onToggle, accent }) {
  return (
    <div
      className="bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center gap-3 px-3 py-2.5 rounded-xl"
      style={enabled ? { borderColor: 'rgba(34,197,94,0.35)' } : undefined}
    >
      <span className={enabled ? 'text-[#4ade80]' : 'text-[var(--text-tertiary)]'}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)] leading-none">{label}</p>
        <p className={`text-[10px] mt-0.5 ${enabled ? 'text-[#4ade80]' : 'text-[var(--text-secondary)]'}`}>
          {enabled && watts > 0 ? `${watts}W` : enabled ? 'On' : 'Off'}
        </p>
      </div>
      <div
        onClick={onToggle}
        className="relative w-11 h-6 bg-[var(--border)] rounded-full transition-colors duration-200 shrink-0 cursor-pointer select-none"
        style={enabled ? { background: accent ?? '#f97316' } : undefined}
      >
        <div
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200"
          style={{ transform: enabled ? 'translateX(22px)' : 'translateX(2px)' }}
        />
      </div>
    </div>
  )
}

const DEVICE_LIST = Object.entries(ECOFLOW_DEVICES).map(([key, d]) => ({ key, ...d }))

function EcoflowSection({ onShowInfo }) {
  const { accent } = useAppStore()
  const chipInactive = { background: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }
  const [selectedKey, setSelectedKey] = useState('delta2Max')
  const [toast, setToast] = useState(null)
  const [, tick] = useState(0)
  const device = ECOFLOW_DEVICES[selectedKey]
  const { data, loading, error, lastUpdated, refetch } = useEcoFlow(device.sn)

  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 15000)
    return () => clearInterval(id)
  }, [])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  const soc = data?.soc ?? null
  const barColor = soc == null ? '#4b5563' : soc > 50 ? '#22c55e' : soc > 20 ? '#f97316' : '#ef4444'
  const totalIn  = data?.totalInputWatts  ?? 0
  const totalOut = data?.totalOutputWatts ?? 0
  const netWatts = totalIn - totalOut

  return (
    <div>
      {toast && <EcoToast message={toast} />}

      <SectionLabel>EcoFlow</SectionLabel>

      {/* Device selector chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3" style={{ scrollbarWidth: 'none' }}>
        {DEVICE_LIST.map(d => (
          <button
            key={d.key}
            onClick={() => setSelectedKey(d.key)}
            className="shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors"
            style={
              d.key === selectedKey
                ? { background: `${accent}26`, borderColor: `${accent}66`, color: accent }
                : chipInactive
            }
          >
            {d.name}
          </button>
        ))}
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-3">
        {/* Card header */}
        <div className="flex items-center justify-between">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ChargingIndicator netFlow={netWatts} />
            <div>
              <div className="text-[var(--text-primary)]" style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.2 }}>{device.name}</div>
              <div className="text-[var(--text-secondary)]" style={{ fontSize: 11, lineHeight: 1.2, marginTop: 2 }}>
                {netWatts > 0 ? `+${netWatts}W · Charging` : netWatts < 0 ? `${netWatts}W · Discharging` : 'Idle'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onShowInfo({ device, data })}
              className="flex items-center justify-center text-[var(--text-secondary)]"
              style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid #3a3a3a', background: 'transparent', fontSize: 12, fontStyle: 'italic', fontWeight: 600, lineHeight: 1 }}
              aria-label="Device info"
            >
              i
            </button>
            <button
              onClick={refetch}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-white transition-colors"
              style={{ background: 'var(--bg-secondary)' }}
              aria-label="Refresh"
            >
              <IconRefresh style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>

        {loading && !data ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Battery bar skeleton */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Skeleton className="h-3 rounded" style={{ width: 52 }} />
                <Skeleton className="h-3 rounded" style={{ width: 36 }} />
              </div>
              <Skeleton className="h-2 rounded-full w-full" />
            </div>
            {/* Power flow grid skeleton */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Skeleton className="rounded-xl" style={{ height: 96 }} />
              <Skeleton className="rounded-xl" style={{ height: 96 }} />
            </div>
            {/* Net / time skeleton */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Skeleton className="rounded-lg" style={{ height: 44 }} />
              <Skeleton className="rounded-lg" style={{ height: 44 }} />
            </div>
            {/* Port rows skeleton */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Skeleton className="rounded-xl" style={{ height: 48 }} />
              <Skeleton className="rounded-xl" style={{ height: 48 }} />
              <Skeleton className="rounded-xl" style={{ height: 48 }} />
            </div>
          </div>
        ) : error ? (
          <p className="text-xs text-[#f87171] text-center py-2">{error}</p>
        ) : (
          <>
            {/* Battery bar */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-[var(--text-secondary)]">Battery</span>
                <span className="text-sm font-bold" style={{ color: barColor }}>
                  {loading ? '—' : soc != null ? `${soc}%` : '—'}
                  {netWatts > 0 && <span style={{ fontSize: 12, marginLeft: 4, color: '#22c55e' }}>⚡</span>}
                </span>
              </div>
              <div className="h-2 bg-[var(--border)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${soc ?? 0}%`, background: barColor }}
                />
              </div>
              {!loading && (
                <div className="flex justify-between mt-1.5">
                  <span className={`text-[10px] font-medium ${totalIn > 0 ? 'text-[#4ade80]' : 'text-[var(--text-tertiary)]'}`}>
                    ↓ {totalIn}W in
                  </span>
                  <span className={`text-[10px] font-medium ${totalOut > 0 ? 'text-[#fb923c]' : 'text-[var(--text-tertiary)]'}`}>
                    ↑ {totalOut}W out
                  </span>
                </div>
              )}
            </div>

            {/* Power flow grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <PowerFlowCard type="in"  data={data} />
              <PowerFlowCard type="out" data={data} />
            </div>

            {/* Net flow + time remaining */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-2.5 py-2 flex flex-col items-center gap-0.5">
                <span className={`text-xs font-bold tabular-nums ${netWatts > 0 ? 'text-[#4ade80]' : netWatts < 0 ? 'text-[#f87171]' : 'text-[var(--text-tertiary)]'}`}>
                  {netWatts > 0 ? `+${netWatts}W` : `${netWatts}W`}
                </span>
                <span className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider">Net</span>
              </div>
              <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-2.5 py-2 flex flex-col items-center gap-0.5">
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  {loading ? '—' : formatRemainTime(data?.remainTime)}
                </span>
                <span className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider">Time left</span>
              </div>
            </div>

            {/* Port toggles */}
            <div className="flex flex-col gap-2">
              <PortToggleRow
                label="AC Output"
                watts={data?.acOutputWatts ?? 0}
                enabled={data?.acEnabled ?? false}
                accent={accent}
                onToggle={() => showToast('Port control coming in Phase 5')}
                icon={<IconPlugZap style={{ width: 14, height: 14 }} />}
              />
              <PortToggleRow
                label="12V DC"
                watts={data?.dcOutputWatts ?? 0}
                enabled={data?.dcEnabled ?? false}
                accent={accent}
                onToggle={() => showToast('Port control coming in Phase 5')}
                icon={<IconCar style={{ width: 14, height: 14 }} />}
              />
              <PortToggleRow
                label="USB & Type-C"
                watts={data?.usbOutputWatts ?? 0}
                enabled={data?.usbEnabled ?? false}
                accent={accent}
                onToggle={() => showToast('Port control coming in Phase 5')}
                icon={<IconUsb style={{ width: 14, height: 14 }} />}
              />
            </div>
          </>
        )}

        {lastUpdated && (
          <p className="text-[10px] text-[var(--text-tertiary)] text-right -mt-1">
            {formatLastUpdated(lastUpdated)}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Starlink ─────────────────────────────────────────────────────────────────

function StarlinkSection() {
  return null
}

// ─── Humidity ─────────────────────────────────────────────────────────────────

function HumiditySection({ haSensors = [] }) {
  const zones = haSensors.length > 0 ? haSensors : HUMIDITY_ZONES
  const isHa = haSensors.length > 0
  return (
    <div>
      <SectionLabel>
        Humidity{isHa && <span style={{ fontSize: 9, color: 'var(--accent)', marginLeft: 6, fontFamily: 'var(--font-mono)', verticalAlign: 'middle' }}>● HA</span>}
      </SectionLabel>
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden divide-y divide-[var(--border)]">
        {zones.map(z => {
          const ok = z.value < 70
          return (
            <div key={z.id} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-[var(--text-secondary)]">{z.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[var(--text-primary)]">{z.value}%</span>
                <StatusBadge status={ok ? 'safe' : 'advisory'} label={ok ? 'OPTIMAL' : 'HIGH'} dot={false} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Lighting ─────────────────────────────────────────────────────────────────

function LightingSection({ lights, onToggle, onBrightness, haLights = [], onHaToggle, onHaBrightness }) {
  const isHa = haLights.length > 0
  return (
    <div>
      <SectionLabel>
        Lighting{isHa && <span style={{ fontSize: 9, color: 'var(--accent)', marginLeft: 6, fontFamily: 'var(--font-mono)', verticalAlign: 'middle' }}>● HA</span>}
      </SectionLabel>
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl divide-y divide-[var(--border)]">
        {isHa ? (
          haLights.map(light => (
            <LightRow
              key={light.id}
              id={light.id}
              label={light.label}
              on={light.on}
              brightness={light.brightness}
              onToggle={() => onHaToggle(light.id, light.on)}
              onBrightness={(v) => onHaBrightness(light.id, v)}
            />
          ))
        ) : (
          Object.keys(lights).map(id => (
            <LightRow
              key={id}
              id={id}
              label={LIGHT_LABELS[id]}
              on={lights[id].on}
              brightness={lights[id].brightness}
              onToggle={() => onToggle(id)}
              onBrightness={(v) => onBrightness(id, v)}
            />
          ))
        )}
      </div>
    </div>
  )
}

function LightRow({ id, label, on, brightness, onToggle, onBrightness }) {
  const { accent } = useAppStore()
  return (
    <div className="pl-4 pr-3 py-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
        <Toggle on={on} onToggle={onToggle} accent={accent} />
      </div>
      <div
        className="overflow-hidden transition-all duration-200"
        style={{ maxHeight: on ? 44 : 0, opacity: on ? 1 : 0 }}
      >
        <div className="flex items-center gap-3 pt-2.5">
          <span className="text-[10px] text-[var(--text-secondary)] w-6 text-right shrink-0">{brightness}%</span>
          <input
            type="range"
            min={5}
            max={100}
            value={brightness}
            onChange={e => onBrightness(Number(e.target.value))}
            className="flex-1 cursor-pointer"
            style={{ accentColor: accent }}
          />
        </div>
      </div>
    </div>
  )
}

function Toggle({ on, onToggle, accent }) {
  return (
    <div
      onClick={onToggle}
      className="relative w-11 h-6 bg-[var(--border)] rounded-full transition-colors duration-200 shrink-0 cursor-pointer select-none"
      style={on ? { background: accent } : undefined}
    >
      <div
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{ transform: on ? 'translateX(22px)' : 'translateX(2px)' }}
      />
    </div>
  )
}

// ─── Scenes ───────────────────────────────────────────────────────────────────

function ScenesSection({ onApply, haScenes = [], onApplyHa }) {
  const { accent } = useAppStore()
  const chipInactive = { background: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }
  const [active, setActive] = useState(null)
  const isHa = haScenes.length > 0

  const sceneList = isHa
    ? haScenes.map(s => ({ name: s.label, haId: s.id }))
    : Object.keys(SCENES).map(name => ({ name, haId: null }))

  const handle = (name, haId) => {
    setActive(name)
    if (haId) onApplyHa(haId)
    else onApply(name)
  }

  return (
    <div>
      <SectionLabel>
        Scene presets{isHa && <span style={{ fontSize: 9, color: 'var(--accent)', marginLeft: 6, fontFamily: 'var(--font-mono)', verticalAlign: 'middle' }}>● HA</span>}
      </SectionLabel>
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {sceneList.map(({ name, haId }) => (
          <button
            key={name}
            onClick={() => handle(name, haId)}
            className="shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors"
            style={active === name
              ? { background: `${accent}26`, borderColor: `${accent}66`, color: accent }
              : chipInactive
            }
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{children}</p>
  )
}
