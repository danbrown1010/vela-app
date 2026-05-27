import { useState, useEffect, useRef } from 'react'
import { Source, Layer } from 'react-map-gl/maplibre'

// RainViewer public API — no key required, CDN tiles with CORS headers.
// maxzoom=10: RainViewer tiles return an error body above zoom 10; MapLibre
// stretches the zoom-10 tile at higher zooms (slight pixelation, acceptable).
// Upgrade path: nowCOAST conus_base_reflectivity_mosaic WMS (verified live at
// nowcoast.noaa.gov/geoserver/observations/weather_radar/ows) is a static tile
// URL requiring no pre-fetch, but CORS from browser contexts is unverified.
// nowCOAST maxzoom is typically 14 — update the cap if switching.
const RAINVIEWER_API = 'https://api.rainviewer.com/public/weather-maps.json'
const TILE_BASE      = 'https://tilecache.rainviewer.com'
const REFRESH_MS     = 10 * 60 * 1000  // 10 minutes

export function PrecipOverlay({ visible, beforeId }) {
  const [tilePath, setTilePath]  = useState(null)
  const warnedRef                = useRef(false)

  // Fetch on mount regardless of visibility — keeps tile path fresh so toggling
  // on doesn't require waiting for the fetch to complete.
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(RAINVIEWER_API)
        if (!r.ok) throw new Error(`RainViewer ${r.status}`)
        const data = await r.json()
        const frames = data?.radar?.past
        if (!frames?.length) throw new Error('no radar frames')
        setTilePath(frames[frames.length - 1].path)
        warnedRef.current = false
      } catch (err) {
        if (!warnedRef.current) {
          console.warn('[PrecipOverlay] radar unavailable:', err.message)
          warnedRef.current = true
        }
      }
    }

    load()
    const id = setInterval(load, REFRESH_MS)
    return () => clearInterval(id)
  }, [])

  if (!visible || !tilePath) return null

  const tileUrl = `${TILE_BASE}${tilePath}/256/{z}/{x}/{y}/2/1_1.png`

  return (
    <Source id="precip" type="raster" tiles={[tileUrl]} tileSize={256} maxzoom={10}>
      <Layer
        id="precip-raster"
        type="raster"
        beforeId={beforeId}
        paint={{ 'raster-opacity': 0.5, 'raster-fade-duration': 0 }}
      />
    </Source>
  )
}
