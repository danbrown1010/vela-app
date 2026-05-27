import { useMemo } from 'react'
import { Source, Layer } from 'react-map-gl/maplibre'
import { SEVERITY_HEX } from '../ThreatHeadline'

const COLOR_MATCH = [
  'match', ['get', 'severity'],
  'extreme',  SEVERITY_HEX.extreme,
  'severe',   SEVERITY_HEX.severe,
  'moderate', SEVERITY_HEX.moderate,
  'minor',    SEVERITY_HEX.minor,
  SEVERITY_HEX.minor,
]

const WIDTH_MATCH = [
  'match', ['get', 'severity'],
  'extreme', 2,
  'severe',  2,
  1.5,
]

export function AlertOverlay({ alerts, visible, beforeId }) {
  const geojson = useMemo(() => {
    if (!alerts || alerts.length === 0) return null
    const features = alerts
      .filter(a => a.geometry != null)
      .map(a => ({
        type: 'Feature',
        geometry: a.geometry,
        properties: {
          id:       a.properties.id,
          severity: (a.properties.severity || 'Minor').toLowerCase(),
          headline: a.properties.headline,
          event:    a.properties.event,
        },
      }))
    if (features.length === 0) return null
    return { type: 'FeatureCollection', features }
  }, [alerts])

  if (!visible || !geojson) return null

  return (
    <Source id="alerts" type="geojson" data={geojson}>
      <Layer
        id="alert-fill"
        type="fill"
        beforeId={beforeId}
        paint={{ 'fill-color': COLOR_MATCH, 'fill-opacity': 0.15 }}
      />
      <Layer
        id="alert-outline"
        type="line"
        beforeId={beforeId}
        paint={{
          'line-color':   COLOR_MATCH,
          'line-opacity': 0.7,
          'line-width':   WIDTH_MATCH,
          // line-dasharray data-driven expressions are not supported in MapLibre GL JS;
          // using solid lines for all severities instead of varying by severity
        }}
      />
    </Source>
  )
}
