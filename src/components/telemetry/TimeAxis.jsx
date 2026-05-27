export function TimeAxis({ oldestT, newestT }) {
  const label = formatSpan(oldestT, newestT)
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      marginTop: 4,
      fontFamily: 'var(--font-mono)',
      fontSize: 9,
      letterSpacing: '0.08em',
      color: 'var(--text-tertiary)',
    }}>
      <span>{label}</span>
      <span>NOW</span>
    </div>
  )
}

function formatSpan(oldestT, newestT) {
  if (!oldestT || !newestT) return '—'
  const spanSec = Math.round((newestT - oldestT) / 1000)
  if (spanSec < 5)  return 'JUST NOW'
  if (spanSec < 60) return `${spanSec}s AGO`
  const min = Math.round(spanSec / 60)
  return `${min}m AGO`
}
