import { createContext, useContext, useEffect, useRef, useState } from 'react'

/* global __BACKGROUND_URLS__ */
const URLS = typeof __BACKGROUND_URLS__ !== 'undefined' ? __BACKGROUND_URLS__ : []
const INTERVAL_MS = 30_000
const TRANSITION_MS = 1500

const BackgroundContext = createContext({ currentSrc: null, nextSrc: null, isTransitioning: false })

function pickRandom(urls, exclude) {
  if (urls.length === 0) return null
  const pool = urls.filter(u => u !== exclude)
  const source = pool.length > 0 ? pool : urls
  return source[Math.floor(Math.random() * source.length)]
}

export function BackgroundProvider({ children }) {
  const [currentSrc, setCurrentSrc] = useState(() => pickRandom(URLS, null))
  const [nextSrc, setNextSrc] = useState(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const currentSrcRef = useRef(currentSrc)

  // Rotation interval: pick next → preload → set nextSrc
  useEffect(() => {
    if (URLS.length === 0) return
    const id = setInterval(() => {
      const next = pickRandom(URLS, currentSrcRef.current)
      if (!next) return
      const img = new Image()
      img.onload = () => setNextSrc(next)
      img.src = next
    }, INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  // When nextSrc is set: wait two frames (so it renders at opacity 0), then fade in,
  // then promote to currentSrc after the CSS transition completes.
  useEffect(() => {
    if (!nextSrc) return
    let raf1, raf2
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setIsTransitioning(true))
    })
    const promote = setTimeout(() => {
      setCurrentSrc(nextSrc)
      currentSrcRef.current = nextSrc
      setNextSrc(null)
      setIsTransitioning(false)
    }, TRANSITION_MS + 50)
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      clearTimeout(promote)
    }
  }, [nextSrc])

  return (
    <BackgroundContext.Provider value={{ currentSrc, nextSrc, isTransitioning }}>
      {children}
    </BackgroundContext.Provider>
  )
}

export function useBackground() {
  return useContext(BackgroundContext)
}
