const W = 600

export function Sparkline({
  samples,
  color = 'var(--text-tertiary)',
  height = 28,
  minValue,
  maxValue,
  ariaLabel,
}) {
  const H = height
  const padding = 4

  if (!samples || samples.length < 2) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-label={ariaLabel}>
        <line
          x1="0" y1={H / 2} x2={W} y2={H / 2}
          stroke="var(--border)" strokeWidth="0.5"
          strokeDasharray="4,4"
        />
      </svg>
    )
  }

  const values = samples.map(s => s.v)
  const lo = minValue != null ? minValue : Math.min(...values)
  const hi = maxValue != null ? maxValue : Math.max(...values)
  const range = hi - lo || 1

  const xStep = W / (samples.length - 1)
  const yFor = v => {
    const clamped = Math.max(lo, Math.min(hi, v))
    return padding + (1 - (clamped - lo) / range) * (H - 2 * padding)
  }

  const points = samples
    .map((s, i) => `${(i * xStep).toFixed(1)},${yFor(s.v).toFixed(1)}`)
    .join(' ')

  const endX = (samples.length - 1) * xStep
  const endY = yFor(values[values.length - 1])

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%" height={H}
      preserveAspectRatio="none"
      aria-label={ariaLabel}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        opacity="0.7"
      />
      <circle cx={endX} cy={endY} r="3" fill={color} />
    </svg>
  )
}
