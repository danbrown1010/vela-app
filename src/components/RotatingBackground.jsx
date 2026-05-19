import { useBackground } from '../contexts/BackgroundContext'

const layerBase = {
  position: 'absolute',
  inset: 0,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
}

export default function RotatingBackground({ overlay }) {
  const { currentSrc, nextSrc, isTransitioning } = useBackground()

  const overlayStyle = overlay ?? 'rgba(0,0,0,0.3)'

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Bottom layer: current image, always fully visible */}
      <div style={{ ...layerBase, backgroundImage: currentSrc ? `url("${currentSrc}")` : 'none' }} />

      {/* Top layer: incoming image, fades in then is promoted by context */}
      {nextSrc && (
        <div style={{
          ...layerBase,
          backgroundImage: `url("${nextSrc}")`,
          opacity: isTransitioning ? 1 : 0,
          transition: 'opacity 1.5s ease-in-out',
        }} />
      )}

      {/* Overlay for text legibility */}
      <div style={{ position: 'absolute', inset: 0, background: overlayStyle }} />
    </div>
  )
}
