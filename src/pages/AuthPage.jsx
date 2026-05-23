import RotatingBackground from '../components/RotatingBackground'

const OVERLAY = `linear-gradient(
  to bottom,
  rgba(26,29,34,0.15) 0%,
  rgba(26,29,34,0.25) 30%,
  rgba(26,29,34,0.70) 60%,
  rgba(26,29,34,0.93) 80%,
  rgba(26,29,34,0.98) 100%
)`

export default function AuthPage({ onSignIn, notAllowed = false }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(var(--vh, 1svh) * 100)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <RotatingBackground overlay={OVERLAY} />

      {/* Content */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '0 28px',
        gap: 18,
      }}>
        {/* VELA logo — absolute top-left */}
        <a href="https://www.vela-go.com" style={{ position: 'absolute', top: 44, left: 24, zIndex: 3, color: 'var(--text-primary)', textDecoration: 'none' }}>
          <img src="/vela-lockup.png" alt="VELA" height={38} style={{ height: 38, width: 'auto', maxWidth: 'none', display: 'block', filter: 'drop-shadow(0 1px 8px rgba(0,0,0,0.5))' }} />
        </a>

        {/* Tag */}
        <div style={{
          fontFamily: 'var(--font-mono)',
          font: '400 11px var(--font-mono)',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'rgba(240,237,228,0.55)',
          textAlign: 'center',
        }}>
          Expedition intelligence
        </div>

        {/* Headline */}
        <div style={{
          fontSize: 'clamp(42px, 10vw, 64px)',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-body)',
          lineHeight: 1.05,
          textAlign: 'center',
          textShadow: '0 2px 20px rgba(0,0,0,0.4)',
          marginTop: -4,
        }}>
          Go Further.
        </div>

        {/* Tagline */}
        <div style={{
          font: '400 14px/1.55 var(--font-body)',
          color: 'rgba(240,237,228,0.75)',
          maxWidth: 280,
          textAlign: 'center',
        }}>
          Real-time fire alerts, EcoFlow monitoring, AI survival expert, and gear registry — built for overlanders who go off the map.
        </div>

        {/* Access restricted banner */}
        {notAllowed && (
          <div style={{
            width: '100%',
            maxWidth: 340,
            background: 'color-mix(in srgb, var(--danger) 85%, transparent)',
            border: '1px solid var(--danger)',
            borderRadius: 12,
            padding: '12px 16px',
            textAlign: 'center',
            backdropFilter: 'blur(8px)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', fontFamily: 'var(--font-body)', marginBottom: 4 }}>
              Access restricted
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontFamily: 'var(--font-body)', lineHeight: 1.5 }}>
              VELA is currently invite-only. Contact danbrown1010@gmail.com to request access.
            </div>
          </div>
        )}

        {/* Google sign-in button */}
        <button
          onClick={onSignIn}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(26,29,34,0.25)',
            border: '1px solid rgba(53,58,66,0.45)',
            borderRadius: 999,
            padding: '12px 24px',
            cursor: 'pointer',
            width: '100%',
            maxWidth: 260,
            justifyContent: 'center',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: '0 4px 32px rgba(0,0,0,0.40)',
            marginTop: 2,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span style={{ font: '600 14px var(--font-body)', color: 'var(--text-primary)' }}>
            Continue with Google
          </span>
        </button>

        {/* Feature pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 320 }}>
          {['Fire & safety alerts', 'EcoFlow monitoring', 'Offline maps', 'AI survival agent', 'Gear registry'].map(f => (
            <div key={f} style={{
              background: 'rgba(240,237,228,0.08)',
              border: '1px solid rgba(240,237,228,0.15)',
              borderRadius: 20,
              padding: '5px 12px',
              fontSize: 11,
              color: 'rgba(240,237,228,0.65)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.04em',
              whiteSpace: 'nowrap',
            }}>
              {f}
            </div>
          ))}
        </div>

        {/* Terms */}
        <div style={{
          font: '400 10px/1.5 var(--font-body)',
          color: 'rgba(240,237,228,0.3)',
          textAlign: 'center',
          maxWidth: 240,
        }}>
          By continuing you agree to our Terms of Service and Privacy Policy.{'\n'}Free to start · PRO from $4.99/mo
        </div>
      </div>
    </div>
  )
}
