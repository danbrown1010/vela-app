import { useState, useEffect } from 'react'
import { X, Camera } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '../lib/supabase'

const SEVERITY = [
  { value: 'low',    label: 'Low',    color: 'var(--status-connected)' },
  { value: 'medium', label: 'Medium', color: 'var(--status-warning)' },
  { value: 'high',   label: 'High',   color: 'var(--status-offline)' },
]

export default function BugReportModal({ meta, user, onClose }) {
  const [description,   setDescription]   = useState('')
  const [severity,      setSeverity]      = useState('medium')
  const [steps,         setSteps]         = useState('')
  const [submitting,    setSubmitting]    = useState(false)
  const [error,         setError]         = useState(null)
  const [submitted,     setSubmitted]     = useState(false)
  const [screenshot,    setScreenshot]    = useState(null)
  const [screenshotUrl, setScreenshotUrl] = useState(null)
  const [isCapturing,   setIsCapturing]   = useState(false)

  useEffect(() => {
    if (!screenshot) { setScreenshotUrl(null); return }
    const url = URL.createObjectURL(screenshot)
    setScreenshotUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [screenshot])

  // Auto-close after successful submit
  useEffect(() => {
    if (!submitted) return
    const t = setTimeout(onClose, 1500)
    return () => clearTimeout(t)
  }, [submitted, onClose])

  const captureScreenshot = async () => {
    setIsCapturing(true)
    setError(null)
    // Yield to React + browser so the modal's visibility:hidden paints before capture
    await new Promise(resolve => setTimeout(resolve, 80))
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        logging: false,
        scale: 1,
      })
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
      setScreenshot(blob)
    } catch (err) {
      console.error('Screenshot capture failed:', err)
      setError('Screenshot capture failed — you can still submit without one.')
    } finally {
      setIsCapturing(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!description.trim() || submitting) return
    setSubmitting(true)
    setError(null)

    const reportId = uuidv4()
    let screenshotPath = null
    let uploadFailed = false

    if (screenshot) {
      const path = `${user.id}/${reportId}.png`
      const { error: uploadErr } = await supabase.storage
        .from('bug-reports')
        .upload(path, screenshot, { contentType: 'image/png' })
      if (uploadErr) {
        uploadFailed = true
      } else {
        screenshotPath = path
      }
    }

    const { error: insertErr } = await supabase.from('bug_reports').insert({
      id: reportId,
      reporter_id: user.id,
      reporter_email: user.email,
      description: description.trim(),
      severity,
      steps_to_reproduce: steps.trim() || null,
      screenshot_path: screenshotPath,
      route: meta.route,
      viewport_width: meta.viewportWidth,
      viewport_height: meta.viewportHeight,
      user_agent: meta.userAgent,
      app_version: meta.appVersion,
      admin_notes: uploadFailed ? 'Screenshot upload failed at submit time.' : null,
    })

    if (insertErr) {
      setError('Submit failed — please try again.')
      setSubmitting(false)
      return
    }

    setSubmitted(true)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 9001,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        backdropFilter: 'blur(2px)',
        // Hide entire overlay during capture so html2canvas sees the raw app
        visibility: isCapturing ? 'hidden' : 'visible',
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !isCapturing) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: 480,
        maxHeight: '90svh',
        overflowY: 'auto',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px 12px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', background: '#f97316', flexShrink: 0,
            }} />
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
              Report a Bug
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>

        {submitted ? (
          <div style={{
            padding: '40px 16px',
            textAlign: 'center',
            color: 'var(--text-primary)',
            fontSize: 14,
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
            Bug report submitted — thanks!
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Screenshot */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Screenshot
              </div>
              {screenshotUrl ? (
                <>
                  <div style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 6 }}>
                    <img
                      src={screenshotUrl}
                      alt="Bug screenshot"
                      style={{ width: '100%', display: 'block', maxHeight: 160, objectFit: 'cover', objectPosition: 'top' }}
                    />
                    <div style={{
                      position: 'absolute', bottom: 4, left: 6,
                      fontSize: 10, color: 'rgba(255,255,255,0.7)',
                      fontFamily: 'monospace',
                      textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                    }}>
                      {meta.route} · {meta.viewportWidth}×{meta.viewportHeight}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                    <button
                      type="button"
                      onClick={captureScreenshot}
                      disabled={isCapturing}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '5px 10px',
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        color: 'var(--text-secondary)',
                        fontSize: 12, cursor: 'pointer',
                      }}
                    >
                      <Camera size={12} /> Retake
                    </button>
                    <button
                      type="button"
                      onClick={() => setScreenshot(null)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '5px 10px',
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        color: 'var(--text-secondary)',
                        fontSize: 12, cursor: 'pointer',
                      }}
                    >
                      <X size={12} /> Remove
                    </button>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                    Map tiles may not appear in screenshot — that's expected.
                  </div>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={captureScreenshot}
                    disabled={isCapturing}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      width: '100%', padding: '9px 0',
                      background: 'var(--bg-secondary)',
                      border: '1px dashed var(--border)',
                      borderRadius: 8,
                      color: isCapturing ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                      fontSize: 13, fontWeight: 500,
                      cursor: isCapturing ? 'default' : 'pointer',
                      transition: 'color 0.1s',
                    }}
                  >
                    <Camera size={14} />
                    {isCapturing ? 'Capturing…' : 'Capture screenshot'}
                  </button>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    Optional. Map tiles may not appear — that's expected.
                  </div>
                </>
              )}
            </div>

            {/* Description */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                Description <span style={{ color: '#f97316' }}>*</span>
              </label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What went wrong?"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '8px 10px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
            </div>

            {/* Severity */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Severity
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {SEVERITY.map(({ value, label, color }) => (
                  <label
                    key={value}
                    style={{
                      flex: 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '7px 0',
                      border: `1px solid ${severity === value ? color : 'var(--border)'}`,
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: severity === value ? `${color}18` : 'transparent',
                      transition: 'all 0.1s',
                    }}
                  >
                    <input
                      type="radio"
                      name="severity"
                      value={value}
                      checked={severity === value}
                      onChange={() => setSeverity(value)}
                      style={{ display: 'none' }}
                    />
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: severity === value ? 600 : 400, color: severity === value ? color : 'var(--text-secondary)' }}>
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Steps */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                Steps to Reproduce <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
              </label>
              <textarea
                rows={4}
                value={steps}
                onChange={e => setSteps(e.target.value)}
                placeholder="1. Go to…&#10;2. Tap…&#10;3. See error"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '8px 10px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
            </div>

            {error && (
              <div style={{ fontSize: 12, color: 'var(--status-offline)', padding: '6px 10px', background: 'rgba(239,68,68,0.1)', borderRadius: 6 }}>
                {error}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1, padding: '9px 0',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--text-secondary)',
                  fontSize: 13, fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !description.trim()}
                style={{
                  flex: 2, padding: '9px 0',
                  background: submitting || !description.trim() ? 'rgba(249,115,22,0.5)' : '#f97316',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 13, fontWeight: 600,
                  cursor: submitting || !description.trim() ? 'default' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {submitting ? 'Submitting…' : 'Submit Report'}
              </button>
            </div>

          </form>
        )}
      </div>
    </div>
  )
}
