import { useState, useEffect } from 'react'
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { supabase } from '../lib/supabase'
import { IconX } from './icons'

function tripDayLabel(trip) {
  const dep = trip?.departureDate ?? trip?.departure_date
  const ret = trip?.returnDate   ?? trip?.return_date
  if (!dep) return null
  const msDay = 86400000
  const start = new Date(dep); start.setHours(0,0,0,0)
  const today = new Date();    today.setHours(0,0,0,0)
  const dayOf = Math.floor((today - start) / msDay) + 1
  if (dayOf < 1) return null
  const totalDays = ret
    ? Math.floor((new Date(new Date(ret).setHours(0,0,0,0)) - start) / msDay) + 1
    : null
  return totalDays ? `DAY ${dayOf} / ${totalDays}` : `DAY ${dayOf}`
}

export function CrewWatchModal({ trip, onClose }) {
  const [position, setPosition] = useState(null)
  const [viewState, setViewState] = useState({ longitude: -120.5, latitude: 47.5, zoom: 6 })
  const [live, setLive] = useState(false)

  useEffect(() => {
    if (!trip?.id) return

    supabase.from('trip_positions').select('*')
      .eq('trip_id', trip.id)
      .order('recorded_at', { ascending: false })
      .limit(1).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPosition(data)
          setLive(true)
          setViewState(v => ({ ...v, longitude: data.lng, latitude: data.lat, zoom: 13 }))
        }
      })

    const channel = supabase.channel(`crew-watch-modal-${trip.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'trip_positions',
        filter: `trip_id=eq.${trip.id}`,
      }, ({ eventType, new: row }) => {
        if (eventType === 'DELETE') {
          setLive(false)
          setPosition(null)
        } else if (row) {
          setPosition(row)
          setLive(true)
          setViewState(v => ({ ...v, longitude: row.lng, latitude: row.lat }))
        }
      })
      .subscribe()

    return () => channel.unsubscribe()
  }, [trip?.id])

  const dayLabel = tripDayLabel(trip)

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ position: 'relative', width: '90%', height: '90%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: 'rgba(28,33,23,0.97)',
          borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2, color: live ? 'var(--safe)' : 'var(--text-tertiary)' }}>
              {live ? '● Live broadcast' : '○ Waiting for position…'}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
              {trip?.name ?? 'Crew Watch'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {dayLabel && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 20, background: 'rgba(196,82,26,0.15)', color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                {dayLabel}
              </span>
            )}
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
            >
              <IconX style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>

        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          <Map
            {...viewState}
            onMove={e => setViewState(e.viewState)}
            mapStyle="https://tiles.openfreemap.org/styles/liberty"
            style={{ width: '100%', height: '100%' }}
          >
            <NavigationControl position="bottom-right" />
            {position && (
              <Marker longitude={position.lng} latitude={position.lat} anchor="center">
                <div style={{ position: 'relative', width: 16, height: 16 }}>
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--accent)', animation: 'crew-ripple 2s ease-out infinite' }} />
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--accent)', border: '2px solid #fff', zIndex: 1 }} />
                </div>
              </Marker>
            )}
          </Map>

          {position && (
            <div style={{
              position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(28,33,23,0.92)', border: '1px solid var(--border)',
              backdropFilter: 'blur(12px)', borderRadius: 12, padding: '10px 20px',
              textAlign: 'center', zIndex: 5, minWidth: 200,
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Crew position</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)' }}>
                {position.lat.toFixed(4)}°N · {Math.abs(position.lng).toFixed(4)}°W
              </div>
              {position.ecoflow_soc != null && (
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>EcoFlow</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: position.ecoflow_soc > 50 ? 'var(--safe)' : position.ecoflow_soc > 20 ? 'var(--status-warning)' : 'var(--status-offline)' }}>
                    {position.ecoflow_soc}%
                  </span>
                  {position.ecoflow_charging != null && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: position.ecoflow_charging ? 'var(--safe)' : 'var(--text-tertiary)' }}>
                      {position.ecoflow_charging ? '⚡ Charging' : 'Discharging'}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <style>{`@keyframes crew-ripple { 0% { transform:scale(1); opacity:0.6; } 100% { transform:scale(3); opacity:0; } }`}</style>
      </div>
    </div>
  )
}
