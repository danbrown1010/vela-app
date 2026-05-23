/* eslint-disable no-undef */
import { useState } from 'react'
import { Bug } from 'lucide-react'
import { useAppStore } from '../store/index'
import { useIsTester } from '../hooks/useIsTester'
import BugReportModal from './BugReportModal'

export default function BugReportButton() {
  const { user } = useAppStore()
  const { isTester, loading } = useIsTester(user?.id)
  const [meta, setMeta] = useState(null)

  if (loading || !isTester) return null

  const handleClick = () => {
    setMeta({
      route: window.location.pathname,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      userAgent: navigator.userAgent,
      appVersion: __APP_VERSION__,
    })
  }

  return (
    <>
      <button
        onClick={handleClick}
        aria-label="Report a bug"
        className="fixed bottom-3 right-3 opacity-50 hover:opacity-100 focus:opacity-100 active:opacity-100 transition-opacity duration-150"
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: '#f97316',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 150,
          boxShadow: '0 4px 14px rgba(249,115,22,0.5)',
          transition: 'background 0.15s, transform 0.1s, opacity 0.15s',
          color: '#fff',
          flexShrink: 0,
        }}
      >
        <Bug size={15} />
      </button>

      {meta && (
        <BugReportModal
          meta={meta}
          user={user}
          onClose={() => setMeta(null)}
        />
      )}
    </>
  )
}
