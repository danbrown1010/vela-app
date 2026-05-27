import { useEffect } from 'react'
import { useChompTelemetry } from '../../hooks/useChompTelemetry'
import { useAppStore } from '../../store/index'
import { useSetSystemStatus } from '../../store/systemStatus'
import { useMetricHistory } from '../../hooks/useMetricHistory'
import { MetricCard } from '../telemetry/MetricCard'
import { CollapsibleSection } from '../telemetry/CollapsibleSection'
import { toneFor, statusWordFor, METRIC_RANGES } from './engineMetricsConfig'

export function EngineTab() {
  const chomp = useChompTelemetry()
  const { location } = useAppStore()
  const setSystemStatus = useSetSystemStatus()

  const { fuel, engine, tripDistance, outsideTempF, isOnline } = chomp

  const speedMph   = location?.speed    != null ? location.speed    * 2.23694 : null
  const altitudeFt = location?.altitude != null ? location.altitude * 3.28084 : null
  const accuracyFt = location?.accuracy != null ? location.accuracy * 3.28084 : null
  const ctx        = { rpm: engine?.rpm ?? 0 }

  // All history calls must be unconditional (Rules of Hooks)
  const coolantHistory   = useMetricHistory(engine?.coolantF)
  const batteryHistory   = useMetricHistory(engine?.batteryV)
  const rpmHistory       = useMetricHistory(engine?.rpm)
  const fuelPctHistory   = useMetricHistory(fuel?.percent)
  const distEmptyHistory = useMetricHistory(fuel?.distanceToEmptyMi)
  const tripMiHistory    = useMetricHistory(tripDistance?.miles)
  const outsideTmpHistory = useMetricHistory(outsideTempF)
  const speedHistory     = useMetricHistory(speedMph)
  const altHistory       = useMetricHistory(altitudeFt)
  const headingHistory   = useMetricHistory(location?.heading)
  const accuracyHistory  = useMetricHistory(accuracyFt)
  const satelliteHistory = useMetricHistory(location?.satellites)
  const latHistory       = useMetricHistory(location?.lat)
  const lngHistory       = useMetricHistory(location?.lng)

  useEffect(() => {
    setSystemStatus('engine', isOnline ? 'connected' : 'offline')
  }, [isOnline, setSystemStatus])

  const engineSummary = [
    engine?.coolantF != null ? `${Math.round(engine.coolantF)}°F` : null,
    engine?.batteryV != null ? `${engine.batteryV.toFixed(1)}V` : null,
    engine?.rpm != null && engine.rpm > 0 ? `${Math.round(engine.rpm).toLocaleString()} RPM` : null,
  ].filter(Boolean).join(' · ') || '—'

  const fuelSummary = [
    fuel?.percent != null ? `${Math.round(fuel.percent)}%` : null,
    fuel?.distanceToEmptyMi != null ? `${Math.round(fuel.distanceToEmptyMi)} mi` : null,
  ].filter(Boolean).join(' · ') || '—'

  const tripSummary = [
    tripDistance?.miles != null ? `${tripDistance.miles.toFixed(1)} mi` : null,
    outsideTempF != null ? `${Math.round(outsideTempF)}°F` : null,
  ].filter(Boolean).join(' · ') || '—'

  const gpsSummary = location?.lat != null
    ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
    : '—'

  return (
    <div>
      {!isOnline && (
        <div style={{
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 18,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
            OBD OFFLINE — JEEP NOT CONNECTED
          </div>
        </div>
      )}

      <CollapsibleSection
        id="engine"
        label="ENGINE"
        summary={engineSummary}
        metricCount={3}
        defaultOpen
      >
        <MetricCard
          label="Coolant Temp"
          value={engine?.coolantF != null ? Math.round(engine.coolantF) : null}
          unit="°F"
          statusTone={toneFor('coolantF', engine?.coolantF, ctx)}
          status={statusWordFor('coolantF', engine?.coolantF, ctx)}
          history={coolantHistory}
          minRange={METRIC_RANGES.coolantF.min}
          maxRange={METRIC_RANGES.coolantF.max}
        />
        <MetricCard
          label="Battery Voltage"
          value={engine?.batteryV != null ? engine.batteryV.toFixed(1) : null}
          unit="V"
          statusTone={toneFor('batteryV', engine?.batteryV, ctx)}
          status={statusWordFor('batteryV', engine?.batteryV, ctx)}
          history={batteryHistory}
          minRange={METRIC_RANGES.batteryV.min}
          maxRange={METRIC_RANGES.batteryV.max}
        />
        <MetricCard
          label="Engine RPM"
          value={engine?.rpm != null ? Math.round(engine.rpm).toLocaleString() : null}
          statusTone={toneFor('rpm', engine?.rpm, ctx)}
          status={statusWordFor('rpm', engine?.rpm, ctx)}
          history={rpmHistory}
          minRange={METRIC_RANGES.rpm.min}
          maxRange={METRIC_RANGES.rpm.max}
        />
      </CollapsibleSection>

      <CollapsibleSection
        id="fuel"
        label="FUEL"
        summary={fuelSummary}
        metricCount={2}
      >
        <MetricCard
          label="Fuel Level"
          value={fuel?.percent != null ? Math.round(fuel.percent) : null}
          unit="%"
          statusTone={toneFor('fuelPercent', fuel?.percent, ctx)}
          status={statusWordFor('fuelPercent', fuel?.percent, ctx)}
          history={fuelPctHistory}
          minRange={METRIC_RANGES.fuelPercent.min}
          maxRange={METRIC_RANGES.fuelPercent.max}
        />
        <MetricCard
          label="Range"
          value={fuel?.distanceToEmptyMi != null ? Math.round(fuel.distanceToEmptyMi) : null}
          unit="mi"
          statusTone={toneFor('distToEmptyMi', fuel?.distanceToEmptyMi, ctx)}
          status={statusWordFor('distToEmptyMi', fuel?.distanceToEmptyMi, ctx)}
          history={distEmptyHistory}
          minRange={METRIC_RANGES.distToEmptyMi.min}
          maxRange={METRIC_RANGES.distToEmptyMi.max}
        />
      </CollapsibleSection>

      <CollapsibleSection
        id="trip"
        label="TRIP"
        summary={tripSummary}
        metricCount={2}
      >
        <MetricCard
          label="Trip Distance"
          sublabel="resets on restart"
          value={tripDistance?.miles != null ? tripDistance.miles.toFixed(1) : null}
          unit="mi"
          statusTone="neutral"
          history={tripMiHistory}
          minRange={METRIC_RANGES.tripMi.min}
          maxRange={METRIC_RANGES.tripMi.max}
        />
        <MetricCard
          label="Outside Temp"
          value={outsideTempF != null ? Math.round(outsideTempF) : null}
          unit="°F"
          statusTone="neutral"
          history={outsideTmpHistory}
          minRange={METRIC_RANGES.outsideTempF.min}
          maxRange={METRIC_RANGES.outsideTempF.max}
        />
      </CollapsibleSection>

      <CollapsibleSection
        id="gps"
        label="GPS"
        summary={gpsSummary}
        metricCount={7}
      >
        <MetricCard
          label="Speed"
          value={speedMph != null ? Math.round(speedMph) : null}
          unit="mph"
          statusTone="neutral"
          history={speedHistory}
          minRange={METRIC_RANGES.speed.min}
          maxRange={METRIC_RANGES.speed.max}
        />
        <MetricCard
          label="Altitude"
          value={altitudeFt != null ? Math.round(altitudeFt).toLocaleString() : null}
          unit="ft"
          statusTone="neutral"
          history={altHistory}
          minRange={METRIC_RANGES.altitude.min}
          maxRange={METRIC_RANGES.altitude.max}
        />
        <MetricCard
          label="Heading"
          value={location?.heading != null ? Math.round(location.heading) : null}
          unit="°"
          statusTone="neutral"
          history={headingHistory}
          minRange={METRIC_RANGES.heading.min}
          maxRange={METRIC_RANGES.heading.max}
        />
        <MetricCard
          label="Accuracy"
          sublabel="GPS precision"
          value={accuracyFt != null ? Math.round(accuracyFt) : null}
          unit="ft"
          statusTone={toneFor('accuracy', accuracyFt, ctx)}
          status={statusWordFor('accuracy', accuracyFt, ctx)}
          history={accuracyHistory}
          minRange={METRIC_RANGES.accuracy.min}
          maxRange={METRIC_RANGES.accuracy.max}
        />
        <MetricCard
          label="Satellites"
          value={location?.satellites != null ? Math.round(location.satellites) : null}
          statusTone={toneFor('satellites', location?.satellites, ctx)}
          status={statusWordFor('satellites', location?.satellites, ctx)}
          history={satelliteHistory}
          minRange={METRIC_RANGES.satellites.min}
          maxRange={METRIC_RANGES.satellites.max}
        />
        <MetricCard
          label="Latitude"
          value={location?.lat != null ? location.lat.toFixed(5) : null}
          statusTone="neutral"
          history={latHistory}
        />
        <MetricCard
          label="Longitude"
          value={location?.lng != null ? location.lng.toFixed(5) : null}
          statusTone="neutral"
          history={lngHistory}
        />
      </CollapsibleSection>

      <UpdatedFooter lastUpdated={engine?.lastUpdated ?? fuel?.lastUpdated} />

      <div style={{
        textAlign: 'center',
        color: 'var(--text-tertiary)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.08em',
        paddingTop: 4,
        paddingBottom: 8,
      }}>
        MORE OBD METRICS COMING SOON
      </div>
    </div>
  )
}

function UpdatedFooter({ lastUpdated }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '4px 0 16px',
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      letterSpacing: '0.08em',
      color: 'var(--text-tertiary)',
    }}>
      <span>UPDATED {lastUpdated ? formatAge(lastUpdated) : '—'}</span>
      <button
        onClick={() => window.location.reload()}
        style={{
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '3px 8px',
          color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.08em',
          cursor: 'pointer',
        }}
      >
        REFRESH
      </button>
    </div>
  )
}

function formatAge(date) {
  if (!date) return '—'
  const sec = Math.round((Date.now() - date.getTime()) / 1000)
  if (sec < 5) return 'JUST NOW'
  if (sec < 60) return `${sec}s AGO`
  const min = Math.round(sec / 60)
  return `${min}m AGO`
}
