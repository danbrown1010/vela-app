import { Popup } from 'react-map-gl/maplibre'

function featureCentroid(geometry) {
  if (!geometry) return null
  let coords = []
  if (geometry.type === 'Polygon') {
    coords = geometry.coordinates[0]
  } else if (geometry.type === 'MultiPolygon') {
    let maxLen = 0
    for (const poly of geometry.coordinates) {
      if (poly[0].length > maxLen) { maxLen = poly[0].length; coords = poly[0] }
    }
  }
  if (!coords.length) return null
  const lngs = coords.map(c => c[0])
  const lats = coords.map(c => c[1])
  return [
    (Math.min(...lngs) + Math.max(...lngs)) / 2,
    (Math.min(...lats) + Math.max(...lats)) / 2,
  ]
}

export function MapFeaturePopup({ feature, kind, onClose }) {
  if (!feature) return null
  const center = featureCentroid(feature.geometry)
  if (!center) return null

  return (
    <Popup
      longitude={center[0]}
      latitude={center[1]}
      onClose={onClose}
      closeButton
      closeOnClick={false}
      anchor="bottom"
      maxWidth="280px"
    >
      {kind === 'fire' && (
        <div style={{ fontFamily: 'var(--font-body)', padding: '4px 2px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
            {feature.properties.IncidentName || 'Fire'}
          </div>
          <div style={{ fontSize: 13 }}>
            {(feature.properties.DailyAcres ?? feature.properties.GISAcres)?.toLocaleString() ?? '—'} acres
          </div>
          <div style={{ fontSize: 13 }}>
            {feature.properties.PercentContained ?? 0}% contained
          </div>
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>Source: NIFC</div>
        </div>
      )}
      {kind === 'alert' && (
        <div style={{ fontFamily: 'var(--font-body)', padding: '4px 2px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
            {feature.properties.event || 'Weather Alert'}
          </div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>
            {feature.properties.headline}
          </div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>Source: NWS</div>
        </div>
      )}
    </Popup>
  )
}
