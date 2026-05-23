import { useState, useRef } from 'react'
import { parseTrackFile, simplifyTrack, sourceFormat } from '../utils/trackParser'

const SIMPLIFICATION_TOLERANCE_M = 10

export function ImportTrackSheet({ open, onClose, onImport, trips = [], defaultTripId = null, accent }) {
  const fileRef   = useRef(null)
  const [file,    setFile]    = useState(null)
  const [name,    setName]    = useState('')
  const [tripId,  setTripId]  = useState(defaultTripId ?? '')
  const [simplify, setSimplify] = useState(false)
  const [preview, setPreview] = useState(null)   // { geojson, pointCount, distanceM, bboxArr }
  const [parseError, setParseError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  const handleFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setParseError(null)
    setPreview(null)
    const defaultName = f.name.replace(/\.[^.]+$/, '')
    setName(defaultName)

    try {
      const text = await f.text()
      const result = parseTrackFile(text, f.name)
      setPreview(result)
    } catch (err) {
      setParseError(err.message)
    }
  }

  const handleSubmit = async () => {
    if (!preview || !name.trim() || submitting) return
    setSubmitting(true)

    try {
      // Yield to React so "Saving…" paints before the synchronous simplify
      // computation locks the JS thread.
      await new Promise(resolve => setTimeout(resolve, 0))

      const geojson = simplify
        ? simplifyTrack(preview.geojson, SIMPLIFICATION_TOLERANCE_M)
        : preview.geojson

      await onImport({
        file,
        name:                    name.trim(),
        tripIdOverride:          tripId || null,
        geojson,
        pointCount:              preview.pointCount,
        distanceM:               preview.distanceM,
        bboxArr:                 preview.bboxArr,
        sourceFormat:            sourceFormat(file.name),
        simplified:              simplify,
        simplificationTolerance: simplify ? SIMPLIFICATION_TOLERANCE_M : null,
      })
      handleClose()
    } catch (err) {
      setParseError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setFile(null); setName(''); setTripId(defaultTripId ?? '')
    setSimplify(false); setPreview(null); setParseError(null); setSubmitting(false)
    onClose()
  }

  const distKm = preview ? (preview.distanceM / 1000).toFixed(1) : null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, backdropFilter: 'blur(2px)' }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0,
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border)',
        borderRadius: '16px 16px 0 0',
        zIndex: 201,
        paddingBottom: 'env(safe-area-inset-bottom)',
        animation: 'slideUpSheet 0.25s ease-out',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4 }}>
          <div style={{ width: 40, height: 5, borderRadius: 3, background: 'var(--border)' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px 14px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
            Import Track
          </div>
          <button
            onClick={handleClose}
            style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* File picker */}
          <div>
            <label style={labelStyle}>Track file</label>
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                width: '100%', padding: '10px 14px',
                background: 'var(--bg-card)', border: `1px solid ${file ? accent : 'var(--border)'}`,
                borderRadius: 10, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
                color: file ? 'var(--text-primary)' : 'var(--text-tertiary)',
                fontFamily: 'var(--font-body)', fontSize: 14, textAlign: 'left',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: file ? accent : 'var(--text-tertiary)' }}>
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
              </svg>
              {file ? file.name : 'Choose .gpx, .kml, .geojson, .json'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".gpx,.kml,.geojson,.json"
              onChange={handleFile}
              style={{ display: 'none' }}
            />
          </div>

          {/* Parse error */}
          {parseError && (
            <div style={{ padding: '8px 12px', background: 'color-mix(in srgb, var(--danger, #ef4444) 12%, transparent)', border: '1px solid var(--danger, #ef4444)', borderRadius: 8, fontSize: 13, color: 'var(--danger, #ef4444)', fontFamily: 'var(--font-body)' }}>
              {parseError}
            </div>
          )}

          {/* Parsed preview */}
          {preview && !parseError && (
            <div style={{ display: 'flex', gap: 10 }}>
              <PreviewChip label="Points" value={preview.pointCount.toLocaleString()} accent={accent} />
              <PreviewChip label="Distance" value={`${distKm} km`} accent={accent} />
            </div>
          )}

          {/* Name */}
          <div>
            <label style={labelStyle}>Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Track name"
              style={inputStyle}
            />
          </div>

          {/* Trip */}
          <div>
            <label style={labelStyle}>Trip</label>
            <select
              value={tripId}
              onChange={e => setTripId(e.target.value)}
              style={{ ...inputStyle, appearance: 'none', backgroundImage: 'none' }}
            >
              <option value="">Standalone (no trip)</option>
              {trips.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Simplify toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontWeight: 500 }}>Simplify track</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>Douglas-Peucker · 10m tolerance</div>
            </div>
            <button
              onClick={() => setSimplify(s => !s)}
              style={{
                width: 44, height: 26, borderRadius: 13,
                background: simplify ? accent : 'var(--border)',
                border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0,
                transition: 'background 0.2s',
              }}
            >
              <div style={{
                position: 'absolute', top: 3,
                left: simplify ? 21 : 3,
                width: 20, height: 20, borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }} />
            </button>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!preview || !name.trim() || submitting}
            style={{
              width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
              background: (!preview || !name.trim()) ? 'var(--border)' : accent,
              color: (!preview || !name.trim()) ? 'var(--text-tertiary)' : '#fff',
              fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-body)',
              cursor: (!preview || !name.trim()) ? 'default' : 'pointer',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {submitting ? 'Saving…' : 'Import track'}
          </button>
        </div>
      </div>
    </>
  )
}

function PreviewChip({ label, value, accent }) {
  return (
    <div style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-card)', border: `1px solid ${accent}40`, borderRadius: 10 }}>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: accent, fontFamily: 'var(--font-mono)' }}>{value}</div>
    </div>
  )
}

const labelStyle = {
  display: 'block',
  fontSize: 11,
  color: 'var(--text-tertiary)',
  fontFamily: 'var(--font-mono)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: 6,
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
}
