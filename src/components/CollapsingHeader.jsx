import { useState, useEffect } from 'react'
import { useAppStore } from '../store/index'

const TRANSITION_PX = 80
const lerp = (a, b, t) => a + (b - a) * t

/**
 * Shared sticky/collapsing header used across all top-level pages.
 *
 * Props:
 *   image       — { src?: string, node?: ReactNode, alt?: string, shape?: 'square' | 'circle' }
 *                 If `node` is provided it renders directly (for SVG logos, icons).
 *                 If `src` is provided it renders as an <img>.
 *                 `shape` controls border-radius (default 'square' = rounded square).
 *   title       — string (displayed in display-weight, uppercased optionally via prop)
 *   subtitle    — string (fades out on scroll)
 *   uppercaseTitle — boolean (default true)
 *   badge       — { label: string, tone?: 'accent' | 'success' | 'muted' } | null
 *                 Pill on the far right of the top row.
 *   gps         — { state: 'locked' | 'searching' | 'off', accuracyM?: number } | null
 *                 Set null to hide the GPS row entirely (use on pages that don't need it).
 *   onOpenSettings — () => void  (renders gear icon)
 *   scrollProgress — optional 0–1 override for pages that use an inner scroll container
 *                    instead of window scroll (e.g. RigPage). When provided the internal
 *                    window.scrollY listener is skipped entirely.
 *   children    — optional content to render below the header (e.g. tab chips).
 *                 Stays inside the sticky region; padding compacts with scroll.
 */
export function CollapsingHeader({
  image,
  title,
  subtitle,
  uppercaseTitle = true,
  badge,
  gps,
  onOpenSettings,
  scrollProgress: scrollProgressProp,
  children,
}) {
  const { accent } = useAppStore()
  const [scrollProgressState, setScrollProgressState] = useState(0)

  useEffect(() => {
    if (scrollProgressProp !== undefined) return
    const onScroll = () => {
      const y = window.scrollY
      const next = Math.min(1, Math.max(0, y / TRANSITION_PX))
      setScrollProgressState(next)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [scrollProgressProp])

  const scrollProgress = scrollProgressProp !== undefined ? scrollProgressProp : scrollProgressState

  const photoSize        = lerp(56, 32, scrollProgress)
  const titleSize        = lerp(28, 18, scrollProgress)
  const subtitleOpacity  = Math.max(0, 1 - scrollProgress * 1.8)
  const gpsLineOpacity   = Math.max(0, 1 - scrollProgress * 1.8)
  const inlineGpsOpacity = scrollProgress > 0.6 ? (scrollProgress - 0.6) / 0.4 : 0
  const headerPaddingY   = lerp(16, 8, scrollProgress)

  const gpsDotColor =
    gps?.state === 'locked'    ? '#22c55e' :
    gps?.state === 'searching' ? '#f59e0b' :
                                  'var(--text-tertiary)'

  const gpsLabel =
    gps?.state === 'locked'    ? `GPS LOCKED · ±${gps.accuracyM ?? '—'}m` :
    gps?.state === 'searching' ? 'GPS SEARCHING' :
                                  'GPS OFF'

  const gpsInlineLabel =
    gps?.state === 'locked'    ? `GPS · ±${gps.accuracyM ?? '—'}m` :
    gps?.state === 'searching' ? 'GPS …' :
                                  'GPS —'

  const badgeColor =
    badge?.tone === 'success' ? '#22c55e' :
    badge?.tone === 'muted'   ? 'var(--text-tertiary)' :
                                 accent

  const titleText = uppercaseTitle ? (title ?? '').toUpperCase() : (title ?? '')

  const radius = image?.shape === 'circle' ? '50%' : 8

  return (
    <div
      style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--bg-primary)',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      {/* Top row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: `${headerPaddingY}px 20px ${lerp(8, 6, scrollProgress)}px`,
      }}>

        {/* Image slot — node OR src */}
        {image?.node ? (
          <div style={{
            width: photoSize, height: photoSize,
            flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {image.node}
          </div>
        ) : image?.src ? (
          <img
            src={image.src}
            alt={image.alt ?? ''}
            style={{
              width: photoSize, height: photoSize, borderRadius: radius,
              objectFit: 'cover', flexShrink: 0,
            }}
          />
        ) : null}

        {/* Title block */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
            <h1 style={{
              margin: 0,
              fontSize: titleSize, fontWeight: 800,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-body)',
              letterSpacing: '0.02em', lineHeight: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {titleText}
            </h1>

            {gps && (
              <span style={{
                opacity: inlineGpsOpacity,
                display: inlineGpsOpacity > 0 ? 'inline-flex' : 'none',
                alignItems: 'center', gap: 5,
                fontSize: 10, fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)',
                letterSpacing: '0.06em',
                flexShrink: 0,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: gpsDotColor,
                }} />
                {gpsInlineLabel}
              </span>
            )}
          </div>

          {subtitle && (
            <div style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-body)',
              marginTop: 3,
              opacity: subtitleOpacity,
              height: subtitleOpacity > 0 ? 'auto' : 0,
              overflow: 'hidden',
              whiteSpace: 'nowrap', textOverflow: 'ellipsis',
            }}>
              {subtitle}
            </div>
          )}
        </div>

        {/* Badge pill */}
        {badge && (
          <div style={{
            padding: '4px 10px', borderRadius: 999,
            border: `1px solid ${badgeColor}`,
            color: badgeColor,
            fontSize: 10, fontFamily: 'var(--font-mono)',
            fontWeight: 700, letterSpacing: '0.08em',
            flexShrink: 0,
            transform: `scale(${lerp(1, 0.85, scrollProgress)})`,
            transformOrigin: 'right center',
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
            {badge.tone === 'success' && (
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: badgeColor,
              }} />
            )}
            {badge.label}
          </div>
        )}

        {/* Settings gear */}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            aria-label="Settings"
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
              transform: `scale(${lerp(1, 0.9, scrollProgress)})`,
              transformOrigin: 'right center',
              color: 'var(--text-secondary)',
            }}
            className="active:opacity-70 transition-opacity"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        )}
      </div>

      {/* GPS line */}
      {gps && (
        <div style={{
          padding: '0 20px',
          height: lerp(20, 0, scrollProgress),
          opacity: gpsLineOpacity,
          overflow: 'hidden',
        }}>
          <div style={{
            fontSize: 11, fontFamily: 'var(--font-mono)',
            color: 'var(--text-secondary)',
            letterSpacing: '0.08em',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: gpsDotColor,
            }} />
            {gpsLabel}
          </div>
        </div>
      )}

      {/* Children (tab chips, etc.) */}
      {children && (
        <div style={{
          padding: `${lerp(12, 8, scrollProgress)}px 20px ${lerp(14, 10, scrollProgress)}px`,
          borderBottom: scrollProgress > 0.5
            ? '1px solid var(--border)'
            : '1px solid transparent',
          transition: 'border-color 0.15s',
        }}>
          {children}
        </div>
      )}

      {!children && scrollProgress > 0.5 && (
        <div style={{ height: 1, background: 'var(--border)' }} />
      )}
    </div>
  )
}
