import { useState, useRef, useLayoutEffect, useCallback } from 'react'

const STORAGE_PREFIX = 'vela-engine-section-'

function readPersisted(id, fallback) {
  try {
    const stored = localStorage.getItem(STORAGE_PREFIX + id)
    if (stored === '1') return true
    if (stored === '0') return false
    return fallback
  } catch {
    return fallback
  }
}

function writePersisted(id, isOpen) {
  try {
    localStorage.setItem(STORAGE_PREFIX + id, isOpen ? '1' : '0')
  } catch { /* quota / private-browsing: silent */ }
}

export function CollapsibleSection({
  id, label, summary, metricCount,
  defaultOpen = false, children,
}) {
  const [isOpen, setIsOpen] = useState(() => readPersisted(id, defaultOpen))
  const contentRef   = useRef(null)
  const initialRef   = useRef(true)   // skip animation on first mount

  const toggle = useCallback(() => {
    setIsOpen(prev => {
      const next = !prev
      writePersisted(id, next)
      return next
    })
  }, [id])

  useLayoutEffect(() => {
    const el = contentRef.current
    if (!el) return

    // First mount: show/hide instantly, no transition
    if (initialRef.current) {
      initialRef.current = false
      if (isOpen) {
        el.style.maxHeight = 'none'
        el.style.opacity   = '1'
        el.style.overflow  = 'visible'
      } else {
        el.style.maxHeight = '0px'
        el.style.opacity   = '0'
        el.style.overflow  = 'hidden'
      }
      return
    }

    el.style.transition = 'max-height 200ms ease, opacity 200ms ease'

    if (isOpen) {
      el.style.maxHeight = '0px'
      el.style.opacity   = '0'
      el.style.overflow  = 'hidden'

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.maxHeight = el.scrollHeight + 'px'
          el.style.opacity   = '1'
        })
      })

      const onEnd = (e) => {
        if (e.propertyName !== 'max-height') return
        el.style.maxHeight = 'none'
        el.style.overflow  = 'visible'
        el.removeEventListener('transitionend', onEnd)
      }
      el.addEventListener('transitionend', onEnd)
      return () => el.removeEventListener('transitionend', onEnd)
    } else {
      el.style.maxHeight = el.scrollHeight + 'px'
      el.style.overflow  = 'hidden'

      // getBoundingClientRect() forces a layout flush without triggering
      // no-unused-expressions — equivalent to the offsetHeight read trick
      el.getBoundingClientRect()

      requestAnimationFrame(() => {
        el.style.maxHeight = '0px'
        el.style.opacity   = '0'
      })
    }
  }, [isOpen])

  return (
    <div style={{ marginBottom: 18 }}>
      {/* Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggle()
          }
        }}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: isOpen ? '4px 0 8px 0' : '14px 16px',
          cursor: 'pointer',
          border: isOpen ? 'none' : '1px solid var(--border)',
          borderRadius: isOpen ? 0 : 10,
          marginBottom: isOpen ? 0 : 12,
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            color: 'var(--text-tertiary)', fontSize: 11, width: 10,
            fontFamily: 'var(--font-mono)',
          }}>
            {isOpen ? '▾' : '▸'}
          </span>
          <span style={{
            color: isOpen ? 'var(--text-tertiary)' : 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontWeight: 500,
          }}>
            {label}
          </span>
          {!isOpen && summary && (
            <span style={{
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
            }}>
              {summary}
            </span>
          )}
        </div>
        <span style={{
          color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.08em',
        }}>
          {metricCount} METRIC{metricCount === 1 ? '' : 'S'}
        </span>
      </div>

      {/* Animated content wrapper */}
      <div ref={contentRef}>
        {children}
      </div>
    </div>
  )
}
