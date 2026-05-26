import { useState, useEffect } from 'react'
import { useHomeAssistant } from '../hooks/useHomeAssistant'
import { deriveChompTelemetry } from '../hooks/useChompTelemetry'
import { IconThermometer, IconLightbulb, IconRadio, IconMoon, IconCpu } from './icons'
import { useSetRigStatus } from '../store/rigStatus'

const HA_FRESHNESS_MS = 45000

export default function HomeAssistantCard() {
  const ha = useHomeAssistant()
  const chomp = deriveChompTelemetry(ha)
  const [activeSection, setActiveSection] = useState('climate')
  const [sysOpen, setSysOpen] = useState(false)
  const setRigStatus = useSetRigStatus()

  const configured = !!ha.token && !!ha.HA_URL
  const age = ha.lastUpdated ? Date.now() - ha.lastUpdated.getTime() : Infinity
  const envStatus =
    ha.haStatus === 'loading' ? 'loading'
    : !configured ? 'unconfigured'
    : (ha.lastError || !ha.connected) ? 'offline'
    : ha.lastUpdated && age < HA_FRESHNESS_MS ? 'connected'
    : 'offline'

  useEffect(() => {
    setRigStatus('env', envStatus)
  }, [envStatus, setRigStatus])

  if (!ha.token) {
    return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <svg viewBox="0 0 24 24" fill="none"
            stroke="var(--text-tertiary)" strokeWidth="1.75"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ width: 18, height: 18 }}>
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <div style={{
            fontSize: 14, fontWeight: 600,
            color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
          }}>
            Home Assistant
          </div>
        </div>
        <div style={{
          fontSize: 12, color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-body)', lineHeight: 1.6,
        }}>
          Configure your HA token in Settings → App Integrations → Home Assistant
        </div>
      </div>
    )
  }

  if (ha.connecting) {
    return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 20, height: 20, borderRadius: '50%',
          border: '2px solid var(--border)',
          borderTopColor: 'var(--accent)',
          animation: 'spin 0.8s linear infinite',
          flexShrink: 0,
        }} />
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}>
          Connecting to ChompOS...
        </div>
      </div>
    )
  }

  if (!ha.connected) {
    return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: 'var(--border)', flexShrink: 0,
        }} />
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 13, fontWeight: 500,
            color: 'var(--text-secondary)', fontFamily: 'var(--font-body)',
          }}>
            ChompOS offline
          </div>
          <div style={{
            fontSize: 11, color: 'var(--text-tertiary)',
            fontFamily: 'var(--font-body)', marginTop: 1,
          }}>
            Connect to Chomp WiFi to access Home Assistant
          </div>
        </div>
        <button
          onClick={ha.connect}
          style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 8, padding: '4px 10px',
            color: 'var(--text-tertiary)', fontSize: 11,
            fontFamily: 'var(--font-mono)', cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  const sections = [
    { id: 'climate', label: 'Climate', Icon: IconThermometer },
    { id: 'lights',  label: 'Lights',  Icon: IconLightbulb   },
    { id: 'media',   label: 'Media',   Icon: IconRadio       },
  ]

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--safe)',
      borderRadius: 14,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--safe)',
            animation: 'pulse 2s ease-in-out infinite',
          }} />
          <div style={{
            fontSize: 13, fontWeight: 600,
            color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
          }}>
            ChompOS
          </div>
          <div style={{
            fontSize: 10, fontFamily: 'var(--font-mono)',
            color: 'var(--safe)', letterSpacing: '0.06em',
          }}>
            CONNECTED
          </div>
        </div>
        <button
          onClick={() => setSysOpen(true)}
          aria-label="System stats"
          style={{
            width: 28, height: 28, borderRadius: 7,
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-tertiary)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <IconCpu style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {/* Section tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
      }}>
        {sections.map(s => {
          const active = activeSection === s.id
          return (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              style={{
                flex: 1, padding: '8px 4px', border: 'none',
                borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                background: 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-tertiary)',
                fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
                textTransform: 'uppercase',
                cursor: 'pointer', transition: 'color 0.2s',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 3,
              }}
            >
              <s.Icon style={{ width: 13, height: 13 }} />
              {s.label}
            </button>
          )
        })}
      </div>

      {/* Section content */}
      <div style={{ padding: '12px 14px' }}>

        {/* ── CLIMATE ── */}
        {activeSection === 'climate' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              {
                label: 'Ursa Minor',
                tempId:  'sensor.ursa_minor_2_temperature',
                humId:   'sensor.ursa_minor_2_humidity',
                powerId: 'binary_sensor.ursa_minor_power',
                battId:  'sensor.ursa_minor_2_battery',
              },
              {
                label: 'Cabin',
                tempId:  'sensor.cabin_temperature',
                humId:   'sensor.cabin_humidity',
                powerId: 'binary_sensor.cabin_power',
                battId:  'sensor.cabin_battery',
              },
              {
                label: 'Outside',
                tempId:  'sensor.outside_temperature',
                humId:   'sensor.outside_humidity',
                powerId: 'binary_sensor.outside_power',
                battId:  'sensor.outside_battery',
              },
              {
                label: 'Refrigerator',
                tempId:  'sensor.iceco_fridge_temperature',
                humId:   'sensor.iceco_fridge_humidity',
                powerId: 'binary_sensor.refrigerator_power',
                battId:  'sensor.iceco_fridge_battery',
              },
            ].map(zone => {
              const temp    = ha.getState(zone.tempId)
              const hum     = zone.humId   ? ha.getState(zone.humId)  : null
              const power   = zone.powerId ? ha.isOn(zone.powerId)    : null
              const rawSoc  = parseFloat(ha.getState(zone.battId))
              const soc     = Number.isFinite(rawSoc) ? rawSoc : null
              const tempNum = parseFloat(temp)
              const humNum  = parseFloat(hum)
              const offline = isSensorOffline(ha, zone)

              if (!temp && !hum) return null

              const battColor = soc == null ? 'var(--text-tertiary)'
                : soc > 50 ? 'var(--text-secondary)'
                : soc > 20 ? 'var(--status-warning)'
                : 'var(--status-offline)'

              return (
                <div key={zone.label} style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 10, padding: '10px 12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{
                      fontSize: 11, fontFamily: 'var(--font-mono)',
                      color: 'var(--text-tertiary)', textTransform: 'uppercase',
                      letterSpacing: '0.06em', marginBottom: 3,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      {zone.label}
                      {power !== null && (
                        <div style={{
                          width: 5, height: 5, borderRadius: '50%',
                          background: power ? 'var(--safe)' : 'var(--border)',
                        }} />
                      )}
                    </div>
                    <div style={{
                      fontSize: offline ? 10 : 22, fontWeight: offline ? 400 : 700,
                      color: offline ? 'var(--text-tertiary)' : 'var(--text-primary)',
                      fontFamily: offline ? 'var(--font-mono)' : 'var(--font-body)',
                      letterSpacing: offline ? '0.08em' : undefined,
                      lineHeight: 1,
                    }}>
                      {offline
                        ? 'ASLEEP'
                        : Number.isFinite(tempNum) ? `${tempNum.toFixed(1)}°` : '—'
                      }
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                    {!offline && hum && (
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
                        {Number.isFinite(humNum)
                          ? <>{humNum.toFixed(0)}%<span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 2 }}>RH</span></>
                          : '—'
                        }
                      </div>
                    )}
                    {!offline && soc != null && (
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 11, fontFamily: 'var(--font-mono)',
                        color: battColor,
                      }}>
                        <IconBattery level={soc} size={14} />
                        <span>{Math.round(soc)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            }).filter(Boolean)}

            {/* ── ENGINE ZONE (5th) — hidden when OBD offline ── */}
            {chomp.isOnline && chomp.engine && (() => {
              const { coolantF, batteryV, status } = chomp.engine
              const dotColor = status === 'critical' ? 'var(--status-offline)'
                : status === 'warning' ? 'var(--status-warning)'
                : 'var(--status-connected)'
              const borderColor = (status === 'critical' || status === 'warning')
                ? `color-mix(in srgb, var(--status-warning) 40%, transparent)`
                : 'var(--border)'
              return (
                <div style={{
                  background: 'var(--bg-secondary)',
                  border: `1px solid ${borderColor}`,
                  borderRadius: 10, padding: '10px 12px',
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 6,
                  }}>
                    <div style={{
                      fontSize: 11, fontFamily: 'var(--font-mono)',
                      color: 'var(--text-tertiary)', textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      Engine
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor }} />
                    </div>
                    <button
                      style={{
                        fontSize: 10, fontFamily: 'var(--font-mono)',
                        color: 'var(--text-tertiary)',
                        background: 'transparent', border: 'none',
                        cursor: 'default', padding: 0,
                        letterSpacing: '0.04em',
                      }}
                    >
                      More telemetry →
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 2 }}>Coolant</div>
                      <div style={{
                        fontSize: 18, fontWeight: 700, lineHeight: 1,
                        color: status === 'normal' ? 'var(--text-primary)' : 'var(--status-warning)',
                        fontFamily: 'var(--font-body)',
                      }}>
                        {coolantF != null ? `${Math.round(coolantF)}°F` : '—'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 2 }}>Battery</div>
                      <div style={{
                        fontSize: 18, fontWeight: 700, lineHeight: 1,
                        color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
                      }}>
                        {batteryV != null ? `${batteryV.toFixed(1)} V` : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* ── LIGHTS ── */}
        {activeSection === 'lights' && (
          <div>
            {(() => {
              const rockLights = [
                { id: 'light.white_rock_lights',              label: 'White',  color: '#F0EDE4' },
                { id: 'light.light_blue_rock_lights',         label: 'Blue',   color: '#60A5FA' },
                { id: 'light.pink_rock_lights',               label: 'Pink',   color: '#F472B6' },
                { id: 'light.yellow_rock_light',              label: 'Yellow', color: '#FBBF24' },
                { id: 'light.rock_lights_red_light_switch',   label: 'Red',    color: '#F87171' },
                { id: 'light.rock_lights_green_light_switch', label: 'Green',  color: '#4A7C3F' },
              ]
              const onCount = rockLights.filter(l => ha.isOn(l.id) === true).length
              return (
                <>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 14px', marginBottom: 12,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: onCount > 0 ? 'var(--status-warning)' : 'var(--text-tertiary)',
                      flexShrink: 0,
                    }} />
                    <div style={{
                      fontSize: 13, fontWeight: 500,
                      color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
                    }}>
                      {onCount === 0
                        ? 'All rock lights off'
                        : onCount === 1
                        ? '1 light on'
                        : `${onCount} of ${rockLights.length} lights on`}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 11, fontFamily: 'var(--font-mono)',
                    color: 'var(--text-tertiary)', textTransform: 'uppercase',
                    letterSpacing: '0.08em', marginBottom: 10,
                  }}>
                    Rock lights
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {rockLights.map(light => {
                const on = ha.isOn(light.id)
                return (
                  <button
                    key={light.id}
                    onClick={() => ha.toggle(light.id)}
                    style={{
                      background: on ? `${light.color}22` : 'var(--bg-secondary)',
                      border: `1px solid ${on ? light.color : 'var(--border)'}`,
                      borderRadius: 10, padding: '12px',
                      display: 'flex', alignItems: 'center', gap: 8,
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}
                  >
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%',
                      background: on ? light.color : 'var(--border)',
                      boxShadow: on ? `0 0 8px ${light.color}` : 'none',
                      transition: 'all 0.2s', flexShrink: 0,
                    }} />
                    <div style={{
                      fontSize: 13, fontWeight: 500,
                      color: on ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      fontFamily: 'var(--font-body)',
                    }}>
                      {light.label}
                    </div>
                  </button>
                    )
                  })}
                  </div>
                </>
              )
            })()}
          </div>
        )}

        {/* ── MEDIA ── */}
        {activeSection === 'media' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(() => {
              const mediaPlayers = [
                { id: 'media_player.chomp_stereo',      label: 'Stereo'  },
                { id: 'media_player.spotify_dan_brown', label: 'Spotify' },
              ]
              const playingCount = mediaPlayers.filter(p => ha.getState(p.id) === 'playing').length
              return (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px', marginBottom: 4,
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: playingCount > 0 ? 'var(--status-connected)' : 'var(--text-tertiary)',
                    flexShrink: 0,
                  }} />
                  <div style={{
                    fontSize: 13, fontWeight: 500,
                    color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
                  }}>
                    {playingCount === 0
                      ? 'Nothing playing'
                      : playingCount === 1
                      ? `Playing on ${mediaPlayers.find(p => ha.getState(p.id) === 'playing')?.label ?? '1 source'}`
                      : `Playing on ${playingCount} sources`}
                  </div>
                </div>
              )
            })()}
            {[
              { id: 'media_player.chomp_stereo',      displayName: 'Chomp Stereo' },
              { id: 'media_player.spotify_dan_brown', displayName: 'Spotify'      },
            ].map(({ id, displayName }) => {
              const state = ha.getState(id)
              const attrs = ha.entities[id]?.attributes
              const isPlaying = state === 'playing'

              return (
                <div key={id} style={{
                  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '12px 14px',
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: attrs?.media_title ? 8 : 0,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
                      {displayName}
                    </div>
                    <div style={{
                      fontSize: 10, fontFamily: 'var(--font-mono)',
                      color: isPlaying ? 'var(--safe)' : 'var(--text-tertiary)',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                      {state ?? '—'}
                    </div>
                  </div>
                  {attrs?.media_title && (
                    <div style={{
                      fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)',
                      marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {attrs.media_title}{attrs.media_artist && ` · ${attrs.media_artist}`}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    {[
                      {
                        service: 'media_previous_track',
                        icon: (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                            style={{ width: 16, height: 16 }}>
                            <polygon points="19 20 9 12 19 4 19 20"/>
                            <line x1="5" y1="19" x2="5" y2="5"/>
                          </svg>
                        ),
                      },
                      {
                        service: isPlaying ? 'media_pause' : 'media_play',
                        primary: true,
                        icon: isPlaying ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                            style={{ width: 18, height: 18 }}>
                            <rect x="6" y="4" width="4" height="16"/>
                            <rect x="14" y="4" width="4" height="16"/>
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                            style={{ width: 18, height: 18 }}>
                            <polygon points="5 3 19 12 5 21 5 3"/>
                          </svg>
                        ),
                      },
                      {
                        service: 'media_next_track',
                        icon: (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                            style={{ width: 16, height: 16 }}>
                            <polygon points="5 4 15 12 5 20 5 4"/>
                            <line x1="19" y1="5" x2="19" y2="19"/>
                          </svg>
                        ),
                      },
                    ].map((ctrl, i) => (
                      <button
                        key={i}
                        onClick={() => ha.callService('media_player', ctrl.service, id)}
                        style={{
                          width: ctrl.primary ? 40 : 32, height: ctrl.primary ? 40 : 32,
                          borderRadius: '50%',
                          border: ctrl.primary && isPlaying ? 'none' : '1px solid var(--border)',
                          background: ctrl.primary ? (isPlaying ? 'var(--accent)' : 'transparent') : 'var(--bg-card)',
                          color: ctrl.primary && isPlaying ? '#fff' : 'var(--text-secondary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        {ctrl.icon}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>

      {ha.lastUpdated && (
        <div style={{
          padding: '6px 14px', borderTop: '1px solid var(--border)',
          fontSize: 10, fontFamily: 'var(--font-mono)',
          color: 'var(--text-tertiary)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
        }}>
          <span>Updated {ha.lastUpdated.toLocaleTimeString()}</span>
          <button onClick={ha.reload} aria-label="Refresh" style={footerRefreshStyle}>↺</button>
        </div>
      )}

      {/* System stats modal */}
      {sysOpen && <SysStatsModal ha={ha} onClose={() => setSysOpen(false)} />}
    </div>
  )
}

const footerRefreshStyle = {
  width: 22, height: 22, borderRadius: 5,
  border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text-tertiary)', fontSize: 11,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}

function SysStatsModal({ ha, onClose }) {
  const cpuTemp    = parseFloat(ha.getState('sensor.system_monitor_processor_temperature'))
  const diskFree   = parseFloat(ha.getState('sensor.system_monitor_disk_free'))
  const diskUsePct = parseFloat(ha.getState('sensor.system_monitor_disk_use_percent'))

  const stats = [
    {
      label: 'CPU Temperature',
      value: Number.isFinite(cpuTemp)    ? `${cpuTemp.toFixed(1)}°C`       : null,
      unit: null,
    },
    {
      label: 'Disk Free',
      value: Number.isFinite(diskFree)   ? `${diskFree.toFixed(2)} GiB`    : null,
      unit: null,
    },
    {
      label: 'Disk Used',
      value: Number.isFinite(diskUsePct) ? `${diskUsePct.toFixed(1)}%`     : null,
      bar: Number.isFinite(diskUsePct) ? diskUsePct : null,
    },
  ]

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, backdropFilter: 'blur(2px)' }}
      />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--bg-card)',
        borderRadius: '16px 16px 0 0',
        padding: '0 0 env(safe-area-inset-bottom)',
        zIndex: 201,
        animation: 'slideUp 0.22s ease-out',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '12px auto 16px' }} />

        <div style={{ padding: '0 20px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <IconCpu style={{ width: 18, height: 18, color: 'var(--accent)' }} />
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
              ChompOS System
            </div>
          </div>

          {stats.map((s, i) => (
            <div key={s.label} style={{
              paddingBottom: 14, marginBottom: 14,
              borderBottom: i < stats.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: s.bar != null ? 8 : 0,
              }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
                  {s.value ?? <IconMoon style={{ width: 13, height: 13, color: 'var(--text-tertiary)' }} />}
                </div>
              </div>
              {s.bar != null && (
                <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${s.bar}%`,
                    background: s.bar > 85 ? 'var(--status-offline)' : s.bar > 65 ? 'var(--status-warning)' : 'var(--status-connected)',
                    transition: 'width 0.4s',
                  }} />
                </div>
              )}
            </div>
          ))}

          <button
            onClick={onClose}
            style={{
              width: '100%', marginTop: 4, padding: '12px',
              borderRadius: 10, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-secondary)',
              fontSize: 14, fontFamily: 'var(--font-body)', cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  )
}


function IconBattery({ level = 0, size = 14, style: extraStyle = {} }) {
  const clamped = Math.max(0, Math.min(100, level))
  const fillWidth = (clamped / 100) * 15
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, ...extraStyle }}>
      <rect x="2" y="7" width="18" height="10" rx="2" ry="2" />
      <line x1="22" y1="11" x2="22" y2="13" />
      {clamped > 0 && (
        <rect x="3.5" y="8.5" width={fillWidth} height={7} fill="currentColor" stroke="none" rx="1" />
      )}
    </svg>
  )
}

function isSensorOffline(ha, zone) {
  const powerState = ha.getState(zone.powerId)
  const powerOff = powerState === 'off'
  const rawBatt = ha.getState(zone.battId)
  const battDepleted = rawBatt != null
    && rawBatt !== 'unavailable'
    && rawBatt !== 'unknown'
    && parseFloat(rawBatt) === 0
  return powerOff || battDepleted
}
