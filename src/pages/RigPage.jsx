import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '../store/index'
import { CollapsingHeader } from '../components/CollapsingHeader'
import { useFleet } from '../hooks/useFleet'
import { supabase } from '../lib/supabase'
import { StatusPill } from '../components/StatusPill'
import HomeAssistantCard from '../components/HomeAssistantCard'
import { CommunicationsSection } from './CommunicationsSection'
import { EcoflowDeviceCard } from '../components/EcoflowDeviceCard'
import { useEcoflowConfig } from '../hooks/useEcoflowConfig'
import { useBatteries } from '../hooks/useBatteries'
import { useEcoFlow } from '../hooks/useEcoFlow'
import { useSystemStatus, useSetSystemStatus } from '../store/systemStatus'
import { useNetworkStatus } from '../hooks/useNetworkStatus'
import { useChompTelemetry } from '../hooks/useChompTelemetry'
import { envToCosState } from '../utils/systemStatus'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RigPage() {
  return <RigPageContent />
}

function RigPageContent() {
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
    if (key !== 'engine' && !integrations[key]) toggleIntegration(key)
    setActiveIntegration(key)
  }
  const { power, comms, env } = useSystemStatus()
  const engineStatus = useSystemStatus('engine')
  const { accent, location, gpsStatus } = useAppStore()
  const network = useNetworkStatus()

  // ── Collapsing header ────────────────────────────────────────────────────────
  const scrollRef = useRef(null)
  const [scrollProgress, setSP] = useState(0)
  const handleScroll = useCallback((e) => {
    const y = e.currentTarget.scrollTop
    setSP(Math.min(1, Math.max(0, y / 80)))
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Collapsing vehicle header + sticky tab chips */}
      {primaryVehicle && (
        <CollapsingHeader
          image={primaryVehicle.photo_url
            ? { src: primaryVehicle.photo_url, alt: primaryVehicle.nickname, shape: 'square' }
            : { node: (
                <div style={{
                  width: '100%', height: '100%', borderRadius: 8,
                  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)"
                    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ width: 22, height: 22 }}>
                    <rect x="1" y="3" width="15" height="13" rx="2"/>
                    <path d="M16 8h4l3 3v5h-7V8z"/>
                    <circle cx="5.5" cy="18.5" r="2.5"/>
                    <circle cx="18.5" cy="18.5" r="2.5"/>
                  </svg>
                </div>
              )
            }
          }
          title={primaryVehicle.nickname || primaryVehicle.make}
          subtitle={[primaryVehicle.year, primaryVehicle.make, primaryVehicle.model, primaryVehicle.trim].filter(Boolean).join(' ')}
          uppercaseTitle={true}
          badge={{ label: 'PRIMARY', tone: 'accent' }}
          gps={{
            state: gpsStatus === 'locked' ? 'locked'
                 : (gpsStatus === 'requesting' || gpsStatus === 'ip-based') ? 'searching'
                 : 'off',
            accuracyM: Math.round(location?.accuracy ?? 0),
          }}
          cos={{ state: envToCosState(env) }}
          net={{ state: network.state }}
          scrollProgress={scrollProgress}
          onOpenSettings={() => window.dispatchEvent(new CustomEvent('vela:open-settings', { detail: {} }))}
        >
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {[
              { key: 'ecoflow',        label: 'Power',          status: power         },
              { key: 'starlink',       label: 'Communications', status: comms         },
              { key: 'home_assistant', label: 'Cabin',          status: env           },
              { key: 'engine',         label: 'Engine',         status: engineStatus  },
            ].map(intg => (
              <StatusPill
                key={intg.key}
                status={intg.status}
                label={intg.label}
                isActive={activeIntegration === intg.key}
                onClick={() => selectIntegration(intg.key)}
                accent={accent}
              />
            ))}
          </div>
        </CollapsingHeader>
      )}

      {/* Telemetry panel — driven by active integration */}
      <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto' }}>
        <div className="p-4 flex flex-col gap-5" style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
          {activeIntegration === 'ecoflow' && <JeepBatteryCard />}
          {activeIntegration === 'ecoflow' && <EcoflowSection onShowInfo={setEcoInfo} />}
          {activeIntegration === 'ecoflow' && (
            <SensorBatteriesSummary onTap={() => setActiveIntegration('home_assistant')} />
          )}
          {activeIntegration === 'starlink' && <CommunicationsSection />}
          {activeIntegration === 'home_assistant' && (
            <HomeAssistantCard />
          )}
          {activeIntegration === 'engine' && (
            <div style={{ padding: '0 0 8px' }}>
              <div style={{
                border: '0.5px dashed var(--border)',
                borderRadius: 10,
                padding: '24px 20px',
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                letterSpacing: '0.08em',
              }}>
                ENGINE TELEMETRY · COMING IN NEXT PASS
              </div>
            </div>
          )}
        </div>
      </div>

      {ecoInfo && createPortal(
        <>
          {/* Backdrop */}
          <div
            onClick={() => setEcoInfo(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              zIndex: 200,
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
            zIndex: 201,
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
        </>,
        document.body,
      )}
    </div>
  )
}

// ─── EcoFlow ──────────────────────────────────────────────────────────────────

const ECOFLOW_FRESHNESS_MS = 25000

function EcoflowSection({ onShowInfo }) {
  const { user, accent } = useAppStore()
  const { featuredDevice, otherDevices, visibleDevices, loaded } = useEcoflowConfig(user?.id)
  const setRigStatus = useSetSystemStatus()

  const [deviceStatuses, setDeviceStatuses] = useState({})
  const reportDeviceStatus = useCallback((sn, status) => {
    setDeviceStatuses(prev => prev[sn] === status ? prev : { ...prev, [sn]: status })
  }, [])

  const powerStatus = !loaded
    ? 'loading'
    : visibleDevices.length === 0
    ? 'unconfigured'
    : Object.values(deviceStatuses).some(s => s === 'connected')
    ? 'connected'
    : 'offline'

  useEffect(() => {
    setRigStatus('power', powerStatus)
  }, [powerStatus, setRigStatus])

  if (!loaded) {
    return (
      <SectionShell title="EcoFlow">
        <div style={emptyMsgStyle}>Loading…</div>
      </SectionShell>
    )
  }

  if (visibleDevices.length === 0) {
    return (
      <SectionShell title="EcoFlow">
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 14, padding: 20, textAlign: 'center',
        }}>
          <div style={{
            fontSize: 14, fontWeight: 600,
            color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
            marginBottom: 4,
          }}>
            No EcoFlow devices selected
          </div>
          <div style={{
            fontSize: 12, color: 'var(--text-secondary)',
            fontFamily: 'var(--font-body)', marginBottom: 16, lineHeight: 1.5,
          }}>
            Choose which devices to monitor in Settings → Integrations → EcoFlow.
          </div>
          <button
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent('vela:open-settings', { detail: { section: 'ecoflow' } })
              )
            }}
            style={{
              padding: '9px 20px', borderRadius: 8, border: 'none',
              background: accent, color: '#fff',
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
            }}
            className="active:opacity-80 transition-opacity"
          >
            Configure in Settings
          </button>
        </div>
      </SectionShell>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SectionHeader title="EcoFlow" />

      {/* Featured device — full card */}
      {featuredDevice && (
        <EcoflowDeviceCard
          device={featuredDevice}
          onShowInfo={onShowInfo}
          onStatus={reportDeviceStatus}
        />
      )}

      {/* Other devices — compact rows */}
      {otherDevices.length > 0 && (
        <>
          <SectionHeader title="Other Devices" style={{ marginTop: 4 }} />
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 14, overflow: 'hidden',
          }}>
            {otherDevices.map((device, idx) => (
              <EcoflowCompactRow
                key={device.id}
                device={device}
                onTap={() => onShowInfo?.({ device })}
                showDivider={idx < otherDevices.length - 1}
                onStatus={reportDeviceStatus}
              />
            ))}
          </div>
        </>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('ecoflow:refresh-all'))}
          aria-label="Refresh all EcoFlow devices"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: 11, fontFamily: 'var(--font-mono)',
            letterSpacing: '0.06em',
            cursor: 'pointer',
          }}
          className="active:opacity-70 transition-opacity"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.5"
               strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 4v6h-6" />
            <path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
            <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
          </svg>
          REFRESH ALL
        </button>
      </div>
    </div>
  )
}

// ─── Compact row for "Other Devices" list ────────────────────────────────────

function EcoflowCompactRow({ device, onTap, showDivider, onStatus }) {
  const { data, loading, error, lastUpdated } = useEcoFlow(device.sn)
  const { accent } = useAppStore()

  const deviceStatus =
    error ? 'offline'
    : lastUpdated && (Date.now() - lastUpdated.getTime()) < ECOFLOW_FRESHNESS_MS ? 'connected'
    : 'offline'

  useEffect(() => {
    if (!loading) onStatus?.(device.sn, deviceStatus)
  }, [deviceStatus, loading])

  const hasBattery = device.capacity > 0
  const soc = data?.soc
  const inW = data?.totalInputWatts ?? 0
  const outW = data?.totalOutputWatts ?? 0
  const netW = inW - outW

  // 5W deadband matches EcoflowDeviceCard
  const flowState = (loading || error) ? 'idle'
    : netW > 5 ? 'charging'
    : netW < -5 ? 'discharging'
    : 'idle'

  const dotColor = error ? '#ef4444'
    : flowState === 'charging' ? 'var(--status-connected)'
    : flowState === 'discharging' ? 'var(--status-warning)'
    : 'var(--text-tertiary)'

  const statusText = error
    ? 'Offline'
    : loading
    ? '…'
    : flowState === 'idle'
    ? 'Idle'
    : `↓${inW}W ↑${outW}W`

  return (
    <button
      onClick={onTap}
      style={{
        width: '100%',
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 14px',
        background: 'transparent', border: 'none',
        borderBottom: showDivider ? '1px solid var(--border)' : 'none',
        cursor: 'pointer', textAlign: 'left',
      }}
      className="active:opacity-70 transition-opacity"
    >
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: dotColor, flexShrink: 0,
      }} />

      <div style={{
        flex: 1, minWidth: 0,
        fontSize: 14, fontWeight: 600,
        color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {device.name}
      </div>

      {hasBattery && soc != null && (
        <div style={{
          fontSize: 14, fontWeight: 700,
          color: accent, fontFamily: 'var(--font-body)',
          flexShrink: 0, minWidth: 42, textAlign: 'right',
        }}>
          {soc}%
        </div>
      )}

      <div style={{
        fontSize: 11, fontFamily: 'var(--font-mono)',
        color: 'var(--text-secondary)',
        flexShrink: 0, minWidth: 80, textAlign: 'right',
      }}>
        {statusText}
      </div>

      <div style={{
        color: 'var(--text-tertiary)', fontSize: 16,
        flexShrink: 0, marginLeft: 2,
      }}>
        ›
      </div>
    </button>
  )
}

// ─── Jeep Battery (OBD) ──────────────────────────────────────────────────────

function JeepBatteryCard() {
  const { isOnline, engine } = useChompTelemetry()

  if (!isOnline || !engine) {
    return (
      <SectionShell title="Jeep Battery">
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}>
            OBD offline — Jeep not connected
          </div>
        </div>
      </SectionShell>
    )
  }

  const { batteryV, rpm } = engine
  const running = rpm != null && rpm > 0
  const batteryStatus = batteryV == null ? null
    : running
    ? (batteryV < 12.5 ? 'critical' : batteryV < 13.0 ? 'warning' : 'normal')
    : (batteryV < 12.0 ? 'critical' : batteryV < 12.4 ? 'warning' : 'normal')

  const dotColor = batteryStatus === 'critical' ? 'var(--status-offline)'
    : batteryStatus === 'warning' ? 'var(--status-warning)'
    : batteryStatus === 'normal'  ? 'var(--status-connected)'
    : 'var(--text-tertiary)'

  const valueColor = batteryStatus === 'critical' ? 'var(--status-offline)'
    : batteryStatus === 'warning' ? 'var(--status-warning)'
    : 'var(--text-primary)'

  const borderColor = batteryStatus === 'critical'
    ? 'color-mix(in srgb, var(--status-offline) 40%, transparent)'
    : batteryStatus === 'warning'
    ? 'color-mix(in srgb, var(--status-warning) 40%, transparent)'
    : 'var(--border)'

  const statusLabel = batteryStatus === 'critical' ? 'Voltage low'
    : batteryStatus === 'warning' ? 'Voltage marginal'
    : running ? 'Charging'
    : 'Idle'

  return (
    <SectionShell title="Jeep Battery">
      <div style={{
        background: 'var(--bg-card)',
        border: `1px solid ${borderColor}`,
        borderRadius: 14,
        padding: '12px 14px',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: rpm != null ? 8 : 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
            <div style={{
              fontSize: 22, fontWeight: 700,
              color: valueColor, fontFamily: 'var(--font-body)',
            }}>
              {batteryV != null ? `${batteryV.toFixed(1)} V` : '—'}
            </div>
          </div>
          <div style={{
            fontSize: 11, fontFamily: 'var(--font-mono)',
            color: batteryStatus === 'normal' ? 'var(--status-connected)'
              : batteryStatus === 'warning'   ? 'var(--status-warning)'
              : batteryStatus === 'critical'  ? 'var(--status-offline)'
              : 'var(--text-tertiary)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            {statusLabel}
          </div>
        </div>
        {rpm != null && (
          <div style={{
            fontSize: 12, fontFamily: 'var(--font-mono)',
            color: 'var(--text-tertiary)', marginLeft: 18,
          }}>
            {Math.round(rpm).toLocaleString()} RPM
          </div>
        )}
      </div>
    </SectionShell>
  )
}

// ─── Section header / shell helpers ──────────────────────────────────────────

function SectionHeader({ title, style }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
      color: 'var(--text-tertiary)',
      textTransform: 'uppercase', letterSpacing: '0.1em',
      ...style,
    }}>
      {title}
    </div>
  )
}

function SectionShell({ title, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SectionHeader title={title} />
      {children}
    </div>
  )
}

const emptyMsgStyle = {
  background: 'var(--bg-card)', border: '1px solid var(--border)',
  borderRadius: 14, padding: 16, fontSize: 12,
  color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)',
  textAlign: 'center',
}

// ─── Sensor batteries summary (Power tab → taps to Environment/CLIMATE) ──────

function SensorBatteriesSummary({ onTap }) {
  const { batteries, isConfigured } = useBatteries()

  if (!isConfigured) return null

  const online     = batteries.filter(b => b.soc != null)
  const low        = online.filter(b => b.soc <= 20)
  const total      = batteries.length
  const allHealthy = low.length === 0 && online.length === total

  const dotColor = allHealthy
    ? 'var(--status-connected)'
    : low.length > 0
    ? 'var(--status-offline)'
    : 'var(--text-tertiary)'

  const summary = total === 0
    ? 'No sensors configured'
    : low.length > 0
    ? `${low.length} sensor${low.length === 1 ? '' : 's'} low`
    : allHealthy
    ? `All ${total} sensors healthy`
    : `${online.length} of ${total} online`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SectionHeader title="Sensor Batteries" />
      <button
        onClick={onTap}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          cursor: 'pointer', textAlign: 'left',
        }}
        className="active:opacity-70 transition-opacity"
      >
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: dotColor, flexShrink: 0,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 600,
            color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
          }}>
            {summary}
          </div>
          <div style={{
            fontSize: 11, color: 'var(--text-tertiary)',
            fontFamily: 'var(--font-mono)', marginTop: 2,
            letterSpacing: '0.06em',
          }}>
            VIEW ON ENVIRONMENT
          </div>
        </div>
        <div style={{ color: 'var(--text-tertiary)', fontSize: 16, flexShrink: 0 }}>›</div>
      </button>
    </div>
  )
}
