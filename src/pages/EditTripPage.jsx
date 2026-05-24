import { useState } from 'react'
import { useAppStore } from '../store/index'
import { TypeSelector } from '../components/TripTypeIcons'
import { IconChevronLeft } from '../components/icons'

export default function EditTripPage({ trip, onClose }) {
  const { accent, updateTrip } = useAppStore()
  const [form, setForm] = useState({
    name:          trip.name          ?? '',
    types:         trip.types?.length ? trip.types : (trip.type ? [trip.type] : []),
    departureDate: trip.departureDate ?? '',
    returnDate:    trip.returnDate    ?? '',
    region:        trip.region        ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await updateTrip({
        ...trip,
        name:          form.name || trip.name,
        type:          form.types[0] ?? trip.type ?? 'Overlanding',
        types:         form.types,
        departureDate: form.departureDate || null,
        returnDate:    form.returnDate    || null,
        region:        form.region,
      })
      onClose()
    } catch (err) {
      console.error('Edit trip error:', err)
      setError('Failed to save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ paddingTop: 'max(12px, env(safe-area-inset-top))', paddingRight: '16px', paddingBottom: '12px', paddingLeft: '16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={onClose}
          style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <IconChevronLeft style={{ width: 20, height: 20, color: 'var(--text-primary)' }} />
        </button>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Edit Trip</span>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: saving ? 'var(--text-tertiary)' : accent, padding: '0 4px', background: 'transparent', border: 'none', cursor: saving ? 'default' : 'pointer' }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 'calc(32px + env(safe-area-inset-bottom))' }}>

        <Field label="Trip name">
          <input
            type="text"
            value={form.name}
            onChange={e => update('name', e.target.value)}
            placeholder="Entiat River — Summer 2025"
            className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none"
            style={{ caretColor: accent }}
            onFocus={e => e.target.style.borderColor = `${accent}80`}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </Field>

        <Field label="Trip type">
          <TypeSelector selected={form.types} onChange={v => update('types', v)} />
        </Field>

        <Field label="Dates">
          <div style={{ display: 'flex', gap: 12 }}>
            <DateCard label="Depart" value={form.departureDate} onChange={v => update('departureDate', v)} />
            <DateCard label="Return" value={form.returnDate}    onChange={v => update('returnDate', v)} />
          </div>
        </Field>

        <Field label="Region">
          <input
            type="text"
            value={form.region}
            onChange={e => update('region', e.target.value)}
            placeholder="Okanogan NF · North Cascades"
            className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none"
            style={{ caretColor: accent }}
            onFocus={e => e.target.style.borderColor = `${accent}80`}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </Field>

        {error && (
          <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 13, color: '#f87171', fontFamily: 'var(--font-body)' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{ width: '100%', background: saving ? 'var(--border)' : accent, color: saving ? 'var(--text-tertiary)' : '#fff', fontWeight: 700, fontSize: 14, borderRadius: 16, padding: '14px 0', border: 'none', cursor: saving ? 'default' : 'pointer', fontFamily: 'var(--font-body)' }}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>

      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{label}</p>
      {children}
    </div>
  )
}

function DateCard({ label, value, onChange }) {
  return (
    <div style={{ flex: 1 }} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 py-3">
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{label}</p>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full text-[var(--text-primary)] text-sm bg-transparent outline-none"
        style={{ colorScheme: 'dark' }}
      />
    </div>
  )
}
