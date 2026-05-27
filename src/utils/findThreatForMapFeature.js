// Match a clicked map feature back to a threat in threats[].
//
// Fire id format in deriveThreats: `fire-${name}-${distMi}mi` — volatile, changes
// as user moves. Stable match key is IncidentName → threat.headline.
//
// Alert id format: p.id (NWS alert id) — matches feature.properties.id directly.

export function findThreatForMapFeature({ kind, feature, threats }) {
  if (!feature?.properties || !threats?.length) return null

  if (kind === 'fire') {
    const incidentName = feature.properties.IncidentName
    if (!incidentName) return null
    return threats.find(t =>
      t.type === 'wildfire' && t.headline === incidentName
    ) ?? null
  }

  if (kind === 'alert') {
    const featId = feature.properties.id
    if (!featId) return null
    return threats.find(t =>
      t.type === 'weather_alert' && t.id === featId
    ) ?? null
  }

  return null
}
