import { useMemo } from 'react'
import { Source, Layer } from 'react-map-gl/maplibre'

const AQI_BANDS = [
  { max: 50,       color: '#10b981' },  // Good
  { max: 100,      color: '#eab308' },  // Moderate
  { max: 150,      color: '#f97316' },  // USG
  { max: 200,      color: '#ef4444' },  // Unhealthy
  { max: 300,      color: '#a855f7' },  // Very Unhealthy
  { max: Infinity, color: '#7f1d1d' },  // Hazardous
]

function aqiColor(v) {
  return (AQI_BANDS.find(b => v <= b.max) ?? AQI_BANDS[AQI_BANDS.length - 1]).color
}

export function AqiOverlay({ aqi, location, visible, beforeId }) {
  const fc = useMemo(() => {
    if (aqi == null || !location) return null
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [location.lng, location.lat] },
        properties: { aqi, color: aqiColor(aqi) },
      }],
    }
  }, [aqi, location])

  if (!visible || !fc) return null

  return (
    <Source id="aqi" type="geojson" data={fc}>
      <Layer
        id="aqi-point"
        type="circle"
        beforeId={beforeId}
        paint={{
          'circle-radius': 12,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.85,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-opacity': 0.9,
          // Future: tap → AQI breakdown sheet. Add to interactiveLayerIds + onClick in TripPage.
        }}
      />
    </Source>
  )
}
