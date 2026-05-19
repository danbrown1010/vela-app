import { useState } from 'react'
import { useHomeAssistant } from '../hooks/useHomeAssistant'
import { IconThermometer, IconFire, IconRadio } from './icons'

export default function HomeAssistantCard() {
  const ha = useHomeAssistant()
  const [activeSection, setActiveSection] = useState('climate')

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
          Connecting to chompOS...
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
            chompOS offline
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
    { id: 'lights',  label: 'Lights',  Icon: IconFire        },
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
            chompOS
          </div>
          <div style={{
            fontSize: 10, fontFamily: 'var(--font-mono)',
            color: 'var(--safe)', letterSpacing: '0.06em',
          }}>
            CONNECTED
          </div>
        </div>
        <button
          onClick={ha.reload}
          style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4 }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
            style={{ width: 14, height: 14 }}>
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
          </svg>
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
                tempId:  'sensor.ursa_minor_temperature',
                humId:   'sensor.ursa_minor_humidity',
                powerId: 'binary_sensor.ursa_minor_power',
                battId:  'sensor.ursa_minor_battery',
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
                tempId:  'sensor.refrigerator_temperature',
                humId:   'sensor.refrigerator_humidity',
                powerId: 'binary_sensor.refrigerator_power',
                battId:  'sensor.refrigerator_battery',
              },
            ].map(zone => {
              const temp  = ha.getState(zone.tempId)
              const hum   = zone.humId  ? ha.getState(zone.humId)  : null
              const power = zone.powerId ? ha.isOn(zone.powerId)   : null
              const rawSoc = parseFloat(ha.getState(zone.battId))
              const soc   = Number.isFinite(rawSoc) ? rawSoc : null

              if (!temp && !hum) return null

              const battColor = soc == null ? 'var(--text-tertiary)'
                : soc > 50 ? '#22c55e'
                : soc > 20 ? '#f59e0b'
                : '#ef4444'

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
                      fontSize: 22, fontWeight: 700,
                      color: 'var(--text-primary)', fontFamily: 'var(--font-body)', lineHeight: 1,
                    }}>
                      {temp ? `${parseFloat(temp).toFixed(1)}°` : '—'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                    {hum && (
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
                        {parseFloat(hum).toFixed(0)}%
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 2 }}>RH</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: battColor }}>
                      <BatteryIcon soc={soc} />
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, lineHeight: 1 }}>
                        {soc != null ? `${Math.round(soc)}%` : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            }).filter(Boolean)}
          </div>
        )}

        {/* ── LIGHTS ── */}
        {activeSection === 'lights' && (
          <div>
            <div style={{
              fontSize: 11, fontFamily: 'var(--font-mono)',
              color: 'var(--text-tertiary)', textTransform: 'uppercase',
              letterSpacing: '0.08em', marginBottom: 10,
            }}>
              Rock lights
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { id: 'light.white_rock_lights',            label: 'White',  color: '#F0EDE4' },
                { id: 'light.light_blue_rock_lights',       label: 'Blue',   color: '#60A5FA' },
                { id: 'light.pink_rock_lights',             label: 'Pink',   color: '#F472B6' },
                { id: 'light.yellow_rock_light',            label: 'Yellow', color: '#FBBF24' },
                { id: 'light.rock_lights_red_light_switch', label: 'Red',    color: '#F87171' },
                { id: 'light.rock_lights_green_light_switch', label: 'Green', color: '#4A7C3F' },
              ].map(light => {
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
          </div>
        )}

        {/* ── MEDIA ── */}
        {activeSection === 'media' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {['media_player.chomp_stereo', 'media_player.spotify_dan_brown'].map(id => {
              const state = ha.getState(id)
              const attrs = ha.entities[id]?.attributes
              const isPlaying = state === 'playing'
              const name = attrs?.friendly_name ||
                id.split('.')[1].replace(/_/g, ' ')

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
                      {name}
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
                          borderRadius: '50%', border: '1px solid var(--border)',
                          background: ctrl.primary ? 'var(--accent)' : 'var(--bg-card)',
                          color: ctrl.primary ? '#fff' : 'var(--text-secondary)',
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
    </div>
  )
}

function BatteryIcon({ soc }) {
  const fillW = soc != null ? Math.max(0, Math.min(1, soc / 100)) * 13.5 : 0
  return (
    <svg viewBox="0 0 22 10" style={{ width: 22, height: 10 }} fill="none">
      {/* body */}
      <rect x="0.75" y="0.75" width="18.5" height="8.5" rx="1.75"
        stroke="currentColor" strokeWidth="1.25" />
      {/* positive terminal */}
      <rect x="19.5" y="3.25" width="2" height="3.5" rx="0.75" fill="currentColor" />
      {/* charge fill */}
      {fillW > 0 && (
        <rect x="2.25" y="2.25" width={fillW} height="5.5" rx="0.75" fill="currentColor" />
      )}
    </svg>
  )
}
