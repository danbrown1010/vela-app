import { useState, useEffect } from 'react'

/* eslint-disable no-undef */
export default function DevRibbon() {
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!expanded) return
    const close = () => setExpanded(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [expanded])

  if (!__ENV_LABEL__) return null

  return (
    <>
      {/* Folded-corner triangle */}
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 9999,
          display: 'block',
          cursor: 'pointer',
        }}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        onClick={(e) => { e.stopPropagation(); setExpanded(v => !v) }}
      >
        <polygon points="0,0 28,0 0,28" fill="rgba(249,115,22,0.5)" />
        {/* Hypotenuse — subtle fold shadow */}
        <line x1="28" y1="0" x2="0" y2="28" stroke="rgba(0,0,0,0.18)" strokeWidth="1" />
      </svg>

      {/* Info card — always mounted, fades in/out */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 32,
          left: 8,
          width: 110,
          padding: '6px 8px',
          background: 'rgba(249,115,22,0.85)',
          borderRadius: 4,
          zIndex: 9999,
          pointerEvents: 'none',
          lineHeight: 1.5,
          opacity: expanded ? 1 : 0,
          transform: expanded ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(-3px)',
          transformOrigin: 'top left',
          transition: 'opacity 0.15s ease-out, transform 0.15s ease-out',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {__ENV_LABEL__}
        </div>
        <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#fff' }}>
          v{__APP_VERSION__}
        </div>
        <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#fff' }}>
          {__BUILD_DATE__}
        </div>
      </div>
    </>
  )
}
