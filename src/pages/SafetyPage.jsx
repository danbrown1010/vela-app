import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { IconAlert } from '../components/icons'
import { Skeleton } from '../components/Skeleton'
import Map, { Source, Layer, Marker } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import distance from '@turf/distance'
import { point } from '@turf/helpers'
import { useFireData } from '../hooks/useFireData'
import { useFireWeather } from '../hooks/useWeather'
import { useAppStore } from '../store/index'
import { StatusBadge } from '../components/StatusBadge'
import { CollapsingHeader } from '../components/CollapsingHeader'
import { useSystemStatus } from '../store/systemStatus'
import { useNetworkStatus } from '../hooks/useNetworkStatus'
import { envToCosState } from '../utils/systemStatus'

const SEED = {
  evac:       { yourZone: 'Clear', advisory: 2, warning: 1, order: 0 },
  conditions: {
    burnBan:     { county: 'Chelan Co.', status: 'Active' },
    privateLand: '2.4mi clear',
    escapeRoute: 'FR 5900 → Hwy 97',
  },
}

function getFireCoord(feature) {
  const geom = feature.geometry
  if (!geom) return null
  if (geom.type === 'Polygon')      return geom.coordinates[0]?.[0]
  if (geom.type === 'MultiPolygon') return geom.coordinates[0]?.[0]?.[0]
  return null
}

function usePullToRefresh(onRefresh) {
  const [pullY, setPullY] = useState(0)
  const startYRef = useRef(0)
  const activeRef = useRef(false)
  const pullYRef  = useRef(0)
  const scrollRef = useRef(null)
  const THRESHOLD = 64

  const onTouchStart = useCallback((e) => {
    if ((scrollRef.current?.scrollTop ?? 0) === 0) {
      startYRef.current = e.touches[0].clientY
      activeRef.current = true
    }
  }, [])

  const onTouchMove = useCallback((e) => {
    if (!activeRef.current) return
    const dy = e.touches[0].clientY - startYRef.current
    if (dy > 0 && (scrollRef.current?.scrollTop ?? 0) === 0) {
      const y = Math.min(dy * 0.5, THRESHOLD)
      pullYRef.current = y
      setPullY(y)
    } else if (dy <= 0) {
      activeRef.current = false
      pullYRef.current = 0
      setPullY(0)
    }
  }, [])

  const onTouchEnd = useCallback(() => {
    if (!activeRef.current) return
    activeRef.current = false
    const reached = pullYRef.current >= THRESHOLD
    pullYRef.current = 0
    setPullY(0)
    if (reached) onRefresh()
  }, [onRefresh])

  return { scrollRef, pullY, onTouchStart, onTouchMove, onTouchEnd }
}

export default function SafetyPage({ focus, onFocusConsumed }) {
  const { location, aqi, gpsStatus } = useAppStore()
  const gpsState = gpsStatus === 'locked' ? 'locked' : (gpsStatus === 'requesting' || gpsStatus === 'ip-based') ? 'searching' : 'off'
  const gpsAccuracyM = Math.round(location?.accuracy ?? 0)
  const envStatus = useSystemStatus('env')
  const network   = useNetworkStatus()
  const { fires, loading: fireLoading, error: fireError, lastUpdated, refetch: refetchFires } = useFireData()
  const { alerts } = useFireWeather(location?.lat, location?.lng)
  const { scrollRef, pullY, onTouchStart, onTouchMove, onTouchEnd } = usePullToRefresh(refetchFires)

  useEffect(() => {
    if (!focus) return
    const id = focus === 'fire-status' ? 'safety-fire-status' : 'safety-conditions'
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      onFocusConsumed?.()
    }
  }, [focus, onFocusConsumed])

  const hasRedFlag   = alerts.some(a => a.properties.event === 'Red Flag Warning')
  const hasFireWatch = alerts.some(a => a.properties.event === 'Fire Weather Watch')
  const redFlagAlert = alerts.find(a => a.properties.event === 'Red Flag Warning')

  const nearbyFires = useMemo(() => {
    if (!fires?.features?.length) return []
    const userLng = location?.lng ?? -120.8830
    const userLat = location?.lat ?? 47.4521
    const userPt  = point([userLng, userLat])
    return fires.features
      .map(f => {
        const coord = getFireCoord(f)
        if (!coord) return null
        const distMi = distance(userPt, point(coord), { units: 'miles' })
        return { name: f.properties?.IncidentName ?? 'Unknown Fire', acres: Math.round(f.properties?.GISAcres ?? 0), distanceMi: Math.round(distMi) }
      })
      .filter(f => f && f.distanceMi <= 100)
      .sort((a, b) => a.distanceMi - b.distanceMi)
  }, [fires, location])

  const nearest    = nearbyFires[0] ?? null
  const updatedStr = lastUpdated ? lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null
  const monitorBadge = hasRedFlag ? 'danger' : hasFireWatch ? 'warn' : 'monitor'
  const monitorLabel = hasRedFlag ? 'RED FLAG' : hasFireWatch ? 'FIRE WATCH' : 'MONITORING'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <CollapsingHeader
        image={{
          node: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ color: 'var(--text-primary)', width: '60%', height: '60%' }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          ),
        }}
        title="SAFETY"
        subtitle="Keeping a check on things"
        badge={{
          label: monitorLabel,
          tone: monitorBadge === 'danger' ? 'danger' : monitorBadge === 'warn' ? 'warn' : 'success',
        }}
        gps={{ state: gpsState, accuracyM: gpsAccuracyM }}
        cos={{ state: envToCosState(envStatus) }}
        net={{ state: network.state }}
        onOpenSettings={() => window.dispatchEvent(new CustomEvent('vela:open-settings', { detail: {} }))}
      />
      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: 'auto' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {pullY > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: pullY, opacity: pullY / 64 }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--text-tertiary)', borderTopColor: 'transparent', transform: `rotate(${(pullY / 64) * 270}deg)` }} />
          </div>
        )}

        <FireStatus nearest={nearest} loading={fireLoading} error={fireError} updatedStr={updatedStr} />

        {hasRedFlag && (
          <div style={{ margin: '0 16px 4px', borderLeft: '3px solid var(--danger)', background: 'rgba(139,46,46,0.1)', borderRadius: '0 8px 8px 0', padding: '8px 12px' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>Red Flag Warning</p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>
              {redFlagAlert?.properties?.headline ?? 'Fire weather conditions in effect'}
            </p>
          </div>
        )}

        <div style={{ padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <EvacZones {...SEED.evac} />
          <Conditions
            burnBan={SEED.conditions.burnBan}
            aqi={aqi}
            hasRedFlag={hasRedFlag}
            hasFireWatch={hasFireWatch}
            privateLand={SEED.conditions.privateLand}
            escapeRoute={SEED.conditions.escapeRoute}
          />
          <FireMap location={location} fires={fires} lastUpdated={lastUpdated} />
        </div>
      </div>

      <div style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}>
        <SOSButton />
      </div>
    </div>
  )
}

// ─── Fire status strip ────────────────────────────────────────────────────────

function FireStatus({ nearest, loading, error, updatedStr }) {
  if (loading) {
    return (
      <div id="safety-fire-status" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Skeleton className="w-2 h-2 rounded-full" />
          <Skeleton className="h-3.5 rounded" style={{ width: 180 }} />
        </div>
        <Skeleton className="h-2.5 rounded" style={{ width: 120, marginLeft: 22 }} />
      </div>
    )
  }

  if (nearest) {
    return (
      <div id="safety-fire-status" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '12px 16px', borderLeft: '4px solid var(--danger)', background: 'rgba(139,46,46,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ position: 'relative', marginTop: 6, flexShrink: 0 }}>
            <span style={{ display: 'block', width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
            <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#ef4444', animation: 'ping 1s cubic-bezier(0,0,0.2,1) infinite', opacity: 0.75 }} />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#f87171' }}>{nearest.name} · {nearest.distanceMi}mi away</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#f87171', opacity: 0.7, marginTop: 2 }}>
              {nearest.acres.toLocaleString()} acres{updatedStr ? ` · Updated ${updatedStr}` : ''}
            </p>
          </div>
        </div>
        <IconAlert style={{ width: 20, height: 20, color: '#f87171', flexShrink: 0, marginTop: 2 }} />
      </div>
    )
  }

  return (
    <div id="safety-fire-status" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderLeft: '4px solid var(--safe)', background: 'rgba(74,124,63,0.06)' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--safe)', flexShrink: 0 }} />
      <div>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--safe)' }}>All clear · No fires within 100mi</p>
        {updatedStr && (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {error ? 'Cached data' : 'NIFC live data'} · Updated {updatedStr}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Evacuation zones ─────────────────────────────────────────────────────────

const EVAC_STYLES = {
  safe:   { bg: 'rgba(74,124,63,0.12)',   border: 'rgba(74,124,63,0.3)',   color: 'var(--safe)' },
  yellow: { bg: 'rgba(196,82,26,0.10)',   border: 'rgba(196,82,26,0.25)', color: 'var(--warn)' },
  amber:  { bg: 'rgba(196,82,26,0.15)',   border: 'rgba(196,82,26,0.35)', color: 'var(--warn)' },
  danger: { bg: 'rgba(139,46,46,0.12)',   border: 'rgba(139,46,46,0.3)',  color: 'var(--danger)' },
}

function EvacZones({ yourZone, advisory, warning, order }) {
  return (
    <div>
      <SectionLabel>Evacuation zones</SectionLabel>
      <div className="grid grid-cols-4 gap-2">
        <EvacChip label="Your zone" value={yourZone}            variant="safe"   />
        <EvacChip label="Advisory"  value={`${advisory}`}       variant="yellow" />
        <EvacChip label="Warning"   value={`${warning}`}        variant="amber"  />
        <EvacChip label="Order"     value={`${order}`}          variant="danger" dim={order === 0} />
      </div>
    </div>
  )
}

function EvacChip({ label, value, variant, dim = false }) {
  const { bg, border, color } = EVAC_STYLES[variant]
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', lineHeight: 1 }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, lineHeight: 1, color: dim ? 'var(--text-tertiary)' : color }}>{value}</span>
    </div>
  )
}

// ─── Conditions ───────────────────────────────────────────────────────────────

function Conditions({ burnBan, aqi, hasRedFlag, hasFireWatch, privateLand, escapeRoute }) {
  const fireWeatherStatus = hasRedFlag ? 'danger' : hasFireWatch ? 'warn' : 'safe'
  const fireWeatherLabel  = hasRedFlag ? 'RED FLAG' : hasFireWatch ? 'FIRE WATCH' : 'ALL CLEAR'
  const aqiStatus = aqi ? (aqi.aqi < 50 ? 'safe' : aqi.aqi <= 100 ? 'advisory' : 'warn') : 'off'
  const aqiLabel  = aqi ? `AQI ${aqi.aqi} · ${aqi.category.toUpperCase()}` : 'FETCHING'

  return (
    <div id="safety-conditions">
      <SectionLabel>Conditions</SectionLabel>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        <CondRow label="Fire weather" right={<StatusBadge status={fireWeatherStatus} label={fireWeatherLabel} />} />
        <CondRow label="AQI" right={<StatusBadge status={aqiStatus} label={aqiLabel} />} />
        <CondRow label="Burn ban" right={<StatusBadge status="warn" label={`${burnBan.status.toUpperCase()} · ${burnBan.county.toUpperCase()}`} />} />
        <CondRow label="Private land" right={<StatusBadge status="safe" label={privateLand.toUpperCase()} />} />
        <CondRow label="Escape route" right={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)' }}>{escapeRoute}</span>} />
      </div>
    </div>
  )
}

function CondRow({ label, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }} className="last:border-b-0">
      <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{label}</span>
      {right}
    </div>
  )
}

// ─── Fire map ─────────────────────────────────────────────────────────────────

function FireMap({ location, fires, lastUpdated }) {
  const updatedStr = lastUpdated ? lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null
  return (
    <div>
      <SectionLabel>Fire map</SectionLabel>
      <div style={{ height: 200, borderRadius: 12, overflow: 'hidden' }}>
        <Map
          mapStyle="https://tiles.openfreemap.org/styles/liberty"
          initialViewState={{ longitude: location?.lng ?? -120.8830, latitude: location?.lat ?? 47.4521, zoom: 8 }}
          interactive={false}
          attributionControl={false}
        >
          {location && (
            <Marker longitude={location.lng} latitude={location.lat} anchor="center">
              <div style={{ position: 'relative', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ position: 'absolute', width: 32, height: 32, borderRadius: '50%', background: 'color-mix(in srgb, var(--accent) 20%, transparent)', animation: 'gps-pulse 2s ease-out infinite' }} />
                <div style={{ position: 'absolute', width: 20, height: 20, borderRadius: '50%', background: 'color-mix(in srgb, var(--accent) 30%, transparent)', animation: 'gps-pulse 2s ease-out infinite', animationDelay: '0.5s' }} />
                <div style={{ position: 'relative', width: 12, height: 12, borderRadius: '50%', background: 'var(--accent)', border: '2.5px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.3)', zIndex: 1 }} />
              </div>
            </Marker>
          )}
          {fires && (
            <Source id="fires-safety" type="geojson" data={fires}>
              <Layer id="fire-fill-safety" type="fill" paint={{ 'fill-color': '#8B2E2E', 'fill-opacity': 0.2 }} />
              <Layer id="fire-outline-safety" type="line" paint={{ 'line-color': '#8B2E2E', 'line-width': 1.5 }} />
            </Source>
          )}
        </Map>
      </div>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6, letterSpacing: '0.06em' }}>
        NIFC FIRE PERIMETER DATA{updatedStr ? ` · UPDATED ${updatedStr}` : ''}
      </p>
    </div>
  )
}

// ─── SOS button ───────────────────────────────────────────────────────────────

const HOLD_MS   = 3000
const RING_CIRC = 100

function SOSButton() {
  const [progress,  setProgress]  = useState(0)
  const [showModal, setShowModal] = useState(false)
  const rafRef   = useRef(null)
  const startRef = useRef(null)

  const startHold = useCallback((e) => {
    if (showModal) return
    e.preventDefault()
    startRef.current = Date.now()
    const tick = () => {
      const pct = Math.min(((Date.now() - startRef.current) / HOLD_MS) * 100, 100)
      setProgress(pct)
      if (pct < 100) { rafRef.current = requestAnimationFrame(tick) } else { setShowModal(true) }
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [showModal])

  const cancelHold = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setProgress(0)
  }, [])

  const handleConfirm = () => { setShowModal(false); setProgress(0) }
  const handleCancel  = () => { setShowModal(false); setProgress(0) }
  const ringOffset = RING_CIRC - (progress / 100) * RING_CIRC

  return (
    <>
      <button
        style={{ width: '100%', background: 'var(--danger)', border: 'none', borderRadius: 14, padding: '14px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, cursor: 'pointer', WebkitUserSelect: 'none', userSelect: 'none' }}
        onPointerDown={startHold} onPointerUp={cancelHold} onPointerLeave={cancelHold} onPointerCancel={cancelHold}
      >
        <div style={{ position: 'relative', width: 28, height: 28, flexShrink: 0, opacity: progress > 0 ? 1 : 0, transition: 'opacity 0.15s' }}>
          <svg className="-rotate-90 w-full h-full" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeDasharray={RING_CIRC} strokeDashoffset={ringOffset} />
          </svg>
        </div>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-body)', letterSpacing: '0.02em' }}>SOS — Hold 3 seconds to broadcast</span>
      </button>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', background: 'rgba(0,0,0,0.8)' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 360 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(139,46,46,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <IconAlert style={{ width: 20, height: 20, color: '#f87171' }} />
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>Broadcast SOS?</p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>This will alert emergency services to your GPS location.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button style={{ flex: 1, padding: '10px 0', borderRadius: 14, fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-body)' }} onClick={handleCancel}>Cancel</button>
              <button style={{ flex: 1, padding: '10px 0', borderRadius: 14, fontSize: 14, fontWeight: 700, color: '#fff', background: 'var(--danger)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }} onClick={handleConfirm}>Confirm Send</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{children}</p>
  )
}
