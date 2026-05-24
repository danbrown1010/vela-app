import { useRef, useState } from 'react'
import { IconChevronRight, IconUpload } from '../components/icons'
import Map, { Source, Layer, Marker } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useAppStore } from '../store/index'
import { useFireData } from '../hooks/useFireData'
import { useTripDocs } from '../hooks/useTripDocs'
import { useTracks } from '../hooks/useTracks'
import { ImportTrackSheet } from '../components/ImportTrackSheet'

const MAP_STYLE   = 'https://tiles.openfreemap.org/styles/liberty'
const CURRENT_POS = [-120.8830, 47.4521]
const PEEK_H      = 120

const WAYPOINTS = [
  { id: 'w1', coords: [-120.9100, 47.4800], name: 'Handy Spring',   night: 'Night 1', distanceMi: 12 },
  { id: 'w2', coords: [-120.8200, 47.3900], name: 'Esmeralda Camp', night: 'Night 2', distanceMi: 18 },
]

const ROUTE_GEOJSON = {
  type: 'FeatureCollection',
  features: [{ type: 'Feature', properties: {}, geometry: {
    type: 'LineString',
    coordinates: [CURRENT_POS, ...WAYPOINTS.map(w => w.coords)],
  }}],
}

const LAYER_CONFIG = [
  { id: 'route',    label: 'Route',    on: true  },
  { id: 'fire',     label: 'Fire',     on: true  },
  { id: 'land',     label: 'Land',     on: false },
  { id: 'partners', label: 'Partners', on: false },
]

export default function TripPage() {
  const { accent, location, activeTrip, trips, user, flags } = useAppStore()
  const { fires } = useFireData()
  const { tracks, importTrack, removeTrack } = useTracks(user?.id, activeTrip?.id ?? null)
  const mapRef = useRef(null)
  const hasFitTracksRef = useRef(false)
  const [layers,   setLayers]   = useState(() => Object.fromEntries(LAYER_CONFIG.map(l => [l.id, l.on])))
  const [expanded, setExpanded] = useState(false)
  const [previewDoc,    setPreviewDoc]    = useState(null)
  const urlCacheRef                       = useRef({})
  const [loadedDocIds,  setLoadedDocIds]  = useState(new Set())
  const [showImport,    setShowImport]    = useState(false)
  const [hiddenTracks,  setHiddenTracks]  = useState(new Set())

  const toggleLayer = id => setLayers(prev => ({ ...prev, [id]: !prev[id] }))
  const toggleTrackVisibility = id => setHiddenTracks(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const recenter = () => {
    if (location && mapRef.current) {
      mapRef.current.flyTo({ center: [location.lng, location.lat], zoom: 14, duration: 1000 })
    }
  }

  const closePreview = () => setPreviewDoc(null)

  return (
    <div className="relative h-full overflow-hidden" style={{ flex: 1, minHeight: 0 }}>

      {/* ── Map ──────────────────────────────────────────────────────────────── */}
      <Map
        ref={mapRef}
        mapStyle={MAP_STYLE}
        initialViewState={{
          longitude: location?.lng ?? CURRENT_POS[0],
          latitude:  location?.lat ?? CURRENT_POS[1],
          zoom: 13,
        }}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
      >
        {fires && layers.fire && (
          <Source id="fires" type="geojson" data={fires}>
            <Layer id="fire-fill"    type="fill" paint={{ 'fill-color': '#C4521A', 'fill-opacity': 0.15 }} />
            <Layer id="fire-outline" type="line" paint={{ 'line-color': '#C4521A', 'line-width': 1.5, 'line-opacity': 0.8 }} />
          </Source>
        )}

        {layers.route && (
          <Source id="route" type="geojson" data={ROUTE_GEOJSON}>
            <Layer
              id="route-line"
              type="line"
              paint={{ 'line-color': accent, 'line-width': 2.5, 'line-dasharray': [3, 2], 'line-opacity': 0.9 }}
              layout={{ 'line-cap': 'butt', 'line-join': 'round' }}
            />
          </Source>
        )}

        {location && (
          <Marker longitude={location.lng} latitude={location.lat} anchor="center">
            <div style={{ position: 'relative', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', width: 32, height: 32, borderRadius: '50%', background: `${accent}33`, animation: 'gps-pulse 2s ease-out infinite' }} />
              <div style={{ position: 'absolute', width: 20, height: 20, borderRadius: '50%', background: `${accent}4d`, animation: 'gps-pulse 2s ease-out infinite', animationDelay: '0.5s' }} />
              <div style={{ position: 'relative', width: 12, height: 12, borderRadius: '50%', background: accent, border: '2.5px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.3)', zIndex: 1 }} />
            </div>
          </Marker>
        )}

        {WAYPOINTS.map(wp => (
          <Marker key={wp.id} longitude={wp.coords[0]} latitude={wp.coords[1]} anchor="bottom">
            <WaypointPin label={`${wp.name} · ${wp.night}`} accent={accent} />
          </Marker>
        ))}

        {/* Imported tracks */}
        {tracks.filter(t => !hiddenTracks.has(t.id)).map(track => (
          <Source key={track.id} id={`track-${track.id}`} type="geojson" data={track.geojson}>
            <Layer
              id={`track-line-${track.id}`}
              type="line"
              filter={['==', ['geometry-type'], 'LineString']}
              paint={{ 'line-color': '#f97316', 'line-width': 3, 'line-opacity': 0.85 }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </Source>
        ))}
      </Map>

      {/* ── Floating UI ──────────────────────────────────────────────────────── */}
      <StatusStrip />
      <LayerStrip layers={LAYER_CONFIG} active={layers} onToggle={toggleLayer} accent={accent} />
      <ZoomControls mapRef={mapRef} />
      <RecenterBtn onPress={recenter} accent={accent} />

      {/* Import track button — gated by feature_flags.track_sharing */}
      {flags.track_sharing !== false && (
        <button
          onClick={() => setShowImport(true)}
          aria-label="Import track"
          style={{
            position: 'absolute', right: 16, top: 92,
            width: 40, height: 40, borderRadius: 12,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-secondary)', cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          <IconUpload style={{ width: 18, height: 18 }} />
        </button>
      )}

      <BottomSheet
        expanded={expanded}
        onToggle={() => setExpanded(e => !e)}
        accent={accent}
        activeTrip={activeTrip}
        user={user}
        setPreviewDoc={setPreviewDoc}
        urlCacheRef={urlCacheRef}
        setLoadedDocIds={setLoadedDocIds}
        tracks={tracks}
        hiddenTracks={hiddenTracks}
        onToggleTrack={toggleTrackVisibility}
        onDeleteTrack={removeTrack}
      />

      {flags.track_sharing !== false && (
        <ImportTrackSheet
          open={showImport}
          onClose={() => setShowImport(false)}
          onImport={importTrack}
          trips={trips}
          defaultTripId={activeTrip?.id ?? null}
          accent={accent}
        />
      )}

      {/* Doc preview modal */}
      {previewDoc && (
        <div
          onClick={closePreview}
          style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px 16px 0 0', padding: 20, maxHeight: '70vh', overflowY: 'auto' }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', marginBottom: 4 }}>{previewDoc.title}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginBottom: 14, textTransform: 'capitalize' }}>
              {previewDoc.category || previewDoc.type}
            </div>

            {previewDoc.metadata?.confirmation && (
              <div style={{ marginBottom: 14, padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Confirmation</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)', letterSpacing: '0.06em' }}>{previewDoc.metadata.confirmation}</div>
                {previewDoc.metadata.location && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', marginTop: 3 }}>{previewDoc.metadata.location}</div>
                )}
              </div>
            )}

            {previewDoc.content && (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: 12 }}>
                {previewDoc.content}
              </div>
            )}

            {previewDoc.file_path && (
              loadedDocIds.has(previewDoc.id) ? (
                previewDoc.type === 'image' ? (
                  <img src={urlCacheRef.current[previewDoc.id]} alt={previewDoc.title} style={{ width: '100%', borderRadius: 8, maxHeight: 260, objectFit: 'contain', marginBottom: 12 }} />
                ) : (
                  <a href={urlCacheRef.current[previewDoc.id]} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--accent)', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 500, textDecoration: 'none', marginBottom: 12 }}>
                    Open {previewDoc.file_name} →
                  </a>
                )
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', marginBottom: 12 }}>Loading document...</div>
              )
            )}

            {previewDoc.extracted_text && !previewDoc.content && (
              <div style={{ padding: '8px 10px', background: 'var(--bg-card)', borderRadius: 6, fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', lineHeight: 1.5, maxHeight: 100, overflow: 'hidden', marginBottom: 12 }}>
                {previewDoc.extracted_text.slice(0, 300)}...
              </div>
            )}

            <button
              onClick={closePreview}
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontFamily: 'var(--font-body)', cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Status strip ─────────────────────────────────────────────────────────────

function StatusStrip() {
  return (
    <div style={{ position: 'absolute', top: 12, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 8, pointerEvents: 'none', zIndex: 10 }}>
      {['DAY 1/3', 'LTE', '87%'].map(label => (
        <div
          key={label}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: '5px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            backdropFilter: 'blur(8px)',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--safe)', display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.06em' }}>{label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Layer toggle strip ───────────────────────────────────────────────────────

function LayerStrip({ layers, active, onToggle, accent }) {
  return (
    <div
      style={{ position: 'absolute', top: 52, left: 0, right: 0, display: 'flex', gap: 8, overflowX: 'auto', padding: '0 16px', scrollbarWidth: 'none' }}
    >
      {layers.map(l => (
        <button
          key={l.id}
          onClick={() => onToggle(l.id)}
          style={active[l.id]
            ? { background: accent, color: 'white', border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'var(--font-body)' }
            : { background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'var(--font-body)' }
          }
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}

// ─── Markers ──────────────────────────────────────────────────────────────────

function WaypointPin({ label, accent }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{
        background: 'var(--bg-card)',
        border: `1px solid ${accent}80`,
        color: 'var(--text-primary)',
        fontSize: 10,
        fontWeight: 600,
        fontFamily: 'var(--font-body)',
        padding: '4px 10px',
        borderRadius: 20,
        marginBottom: 4,
        whiteSpace: 'nowrap',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }}>
        {label}
      </div>
      <svg width="14" height="20" viewBox="0 0 14 20" fill="none">
        <path d="M7 0C3.13 0 0 3.13 0 7C0 12.25 7 20 7 20C7 20 14 12.25 14 7C14 3.13 10.87 0 7 0Z" fill={accent} />
        <circle cx="7" cy="7" r="2.8" fill="white" />
      </svg>
    </div>
  )
}

// ─── Zoom controls ────────────────────────────────────────────────────────────

function ZoomControls({ mapRef }) {
  return (
    <div style={{ position: 'absolute', right: 16, bottom: PEEK_H + 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {[{ label: '+', method: 'zoomIn' }, { label: '−', method: 'zoomOut' }].map(({ label, method }) => (
        <button
          key={method}
          onClick={() => mapRef.current?.getMap()?.[method]()}
          style={{
            width: 40, height: 40,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 20, fontWeight: 700,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ─── Recenter button ──────────────────────────────────────────────────────────

function RecenterBtn({ onPress, accent }) {
  return (
    <button
      onClick={onPress}
      style={{
        position: 'absolute', left: 16, bottom: PEEK_H + 16,
        width: 44, height: 44, borderRadius: '50%',
        background: accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: 'white' }}>
        <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="2" />
        <path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  )
}

// ─── Bottom sheet ─────────────────────────────────────────────────────────────

function BottomSheet({ expanded, onToggle, accent, activeTrip, user, setPreviewDoc, urlCacheRef, setLoadedDocIds, tracks = [], hiddenTracks, onToggleTrack, onDeleteTrack }) {
  const { docs, loading: docsLoading, getDocUrl } = useTripDocs(activeTrip?.id, user?.id)
  const [docsExpanded,   setDocsExpanded]   = useState(true)
  const [tracksExpanded, setTracksExpanded] = useState(true)

  return (
    <div
      style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: 'var(--bg-card)',
        borderTop: '1px solid var(--border)',
        borderRadius: '16px 16px 0 0',
        overflow: 'hidden',
        height: expanded ? 380 : PEEK_H,
        transition: 'height 0.28s cubic-bezier(0.32,0.72,0,1)',
      }}
    >
      {/* Drag handle */}
      <button
        onClick={onToggle}
        style={{ width: '100%', display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 8 }}
      >
        <div style={{ width: 40, height: 5, borderRadius: 3, background: 'var(--border)' }} />
      </button>

      {/* Peek content — always visible */}
      <div style={{ padding: '0 16px' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Next waypoint</p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 3 }}>Handy Spring · 12mi</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button style={{ flex: 1, background: accent, color: 'white', fontSize: 14, fontWeight: 600, borderRadius: 12, padding: '9px 0', fontFamily: 'var(--font-body)', border: 'none' }}>
            Navigate
          </button>
          <button style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, borderRadius: 12, padding: '9px 0', fontFamily: 'var(--font-body)' }}>
            Add waypoint
          </button>
        </div>
      </div>

      {/* Expanded: scrollable content */}
      <div style={{ opacity: expanded ? 1 : 0, pointerEvents: expanded ? 'auto' : 'none', transition: 'opacity 0.2s', overflowY: 'auto', maxHeight: 260, padding: '0 16px 16px' }}>
        {/* Waypoints */}
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 16, marginBottom: 8 }}>
          All waypoints
        </p>
        {WAYPOINTS.map((wp, i) => (
          <div key={wp.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: accent, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{wp.name}</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{wp.night} · {wp.distanceMi}mi</p>
            </div>
            <IconChevronRight style={{ width: 16, height: 16, color: 'var(--text-tertiary)', flexShrink: 0 }} />
          </div>
        ))}

        {/* Imported tracks */}
        {tracks.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => setTracksExpanded(e => !e)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: '0 0 8px', cursor: 'pointer' }}
            >
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                  <path d="M3 12h18M3 6l9-3 9 3M3 18l9 3 9-3"/>
                </svg>
                Tracks · {tracks.length}
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
                style={{ width: 12, height: 12, transform: tracksExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>

            {tracksExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {tracks.map(track => {
                  const isHidden = hiddenTracks?.has(track.id)
                  const distKm = (track.distance_m / 1000).toFixed(1)
                  return (
                    <div key={track.id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: isHidden ? 'var(--border)' : '#f97316', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
                          {distKm} km · {track.point_count.toLocaleString()} pts · {track.source_format.toUpperCase()}
                        </div>
                      </div>
                      <button
                        onClick={() => onToggleTrack?.(track.id)}
                        style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                        aria-label={isHidden ? 'Show track' : 'Hide track'}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                          {isHidden
                            ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                            : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                          }
                        </svg>
                      </button>
                      <button
                        onClick={() => onDeleteTrack?.(track.id)}
                        style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                        aria-label="Delete track"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Trip Documents */}
        {(docs.length > 0 || docsLoading) && (
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => setDocsExpanded(e => !e)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: '0 0 8px', cursor: 'pointer' }}
            >
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                </svg>
                Documents · {docs.length}
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
                style={{ width: 12, height: 12, transform: docsExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>

            {docsExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {docsLoading ? (
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', padding: '8px 0' }}>Loading documents...</div>
                ) : docs.map(doc => (
                  <div
                    key={doc.id}
                    onClick={async () => {
                        setPreviewDoc(doc)
                        if (urlCacheRef.current[doc.id]) return
                        if (doc.file_path) {
                          try {
                            const url = await getDocUrl(doc)
                            urlCacheRef.current[doc.id] = url
                            setLoadedDocIds(prev => new Set([...prev, doc.id]))
                          } catch (err) {
                            console.error('URL error:', err)
                          }
                        }
                      }}
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                  >
                    <div style={{ color: 'var(--accent)', flexShrink: 0, display: 'flex' }}>
                      {doc.type === 'pdf' ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        </svg>
                      ) : doc.type === 'image' ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/>
                        </svg>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 1, textTransform: 'capitalize' }}>
                        {doc.category || doc.type}{doc.metadata?.confirmation && ` · ${doc.metadata.confirmation}`}
                      </div>
                    </div>
                    <IconChevronRight style={{ width: 12, height: 12, color: 'var(--text-tertiary)', flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
