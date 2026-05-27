import { Source, Layer } from 'react-map-gl/maplibre'
import { SEVERITY_HEX } from '../ThreatHeadline'

const COLOR_RAMP = [
  'interpolate', ['linear'],
  ['coalesce', ['get', 'DailyAcres'], ['get', 'GISAcres'], 0],
  0,     SEVERITY_HEX.minor,
  100,   SEVERITY_HEX.moderate,
  1000,  SEVERITY_HEX.severe,
  10000, SEVERITY_HEX.extreme,
]

export function FireOverlay({ fires, visible, beforeId }) {
  if (!visible || !fires || fires.features.length === 0) return null

  return (
    <Source id="fires" type="geojson" data={fires}>
      <Layer
        id="fire-fill"
        type="fill"
        beforeId={beforeId}
        paint={{ 'fill-color': COLOR_RAMP, 'fill-opacity': 0.25 }}
      />
      <Layer
        id="fire-outline"
        type="line"
        beforeId={beforeId}
        paint={{ 'line-color': COLOR_RAMP, 'line-opacity': 0.8, 'line-width': 1.5 }}
      />
    </Source>
  )
}
