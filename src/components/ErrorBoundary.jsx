import { Component } from 'react'
import { supabase } from '../lib/supabase'

/* eslint-disable no-undef */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, { componentStack }) {
    // Best-effort post to error_logs — never throws back into the boundary
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const envLabel   = typeof __ENV_LABEL__   !== 'undefined' ? __ENV_LABEL__   : ''
        const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : ''
        const source = [
          window.location.pathname,
          envLabel ? `${envLabel} v${appVersion}` : null,
        ].filter(Boolean).join(' | ')

        await supabase.from('error_logs').insert({
          user_id: user?.id ?? null,
          source:  source || null,
          message: error.message,
          stack:   [error.stack, componentStack ? `\n\nComponent stack:${componentStack}` : null].filter(Boolean).join(''),
        })
      } catch { /* swallow — we cannot error inside an error boundary */ }
    })()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const { error } = this.state
    const envLabel = typeof __ENV_LABEL__ !== 'undefined' ? __ENV_LABEL__ : ''

    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--bg-primary)', padding: 24,
      }}>
        <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="var(--text-secondary)" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          <h1 style={{
            fontSize: 20, fontWeight: 700, color: 'var(--text-primary)',
            fontFamily: 'var(--font-body)', marginBottom: 8,
          }}>
            Something went wrong
          </h1>
          <p style={{
            fontSize: 14, color: 'var(--text-secondary)',
            fontFamily: 'var(--font-body)', marginBottom: 24, lineHeight: 1.6,
          }}>
            An unexpected error occurred and has been reported. Reload to continue.
          </p>

          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 28px', borderRadius: 10, border: 'none',
              background: 'var(--accent)', color: '#fff',
              fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>

          {envLabel && (
            <details style={{ marginTop: 24, textAlign: 'left' }}>
              <summary style={{
                fontSize: 12, color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-mono)', cursor: 'pointer',
                userSelect: 'none',
              }}>
                Error details
              </summary>
              <pre style={{
                fontSize: 11, color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap',
                wordBreak: 'break-all', marginTop: 8, padding: 12,
                background: 'var(--bg-secondary)', borderRadius: 8,
                border: '1px solid var(--border)', textAlign: 'left',
              }}>
                {error?.message}{'\n\n'}{error?.stack}
              </pre>
            </details>
          )}
        </div>
      </div>
    )
  }
}
