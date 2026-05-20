export function VelaMark({ size = 32, borderRadius = 8 }) {
  return (
    <img
      src="/vela-mark.png"
      alt="VELA"
      width={size}
      height={size}
      style={{ display: 'block', flexShrink: 0, borderRadius }}
    />
  )
}

export function VelaLogo({ size = 32, textShadow }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <VelaMark size={size} borderRadius={Math.round(size * 0.25)} />
      <span style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 700,
        fontSize: Math.round(size * 0.85),
        letterSpacing: '0.08em',
        color: 'currentColor',
        textShadow,
      }}>VELA</span>
    </div>
  )
}
