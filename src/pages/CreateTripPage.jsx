import { useState, useRef } from 'react'
import { useAppStore } from '../store/index'
import { getDisplayName, getInitials } from '../utils/userHelpers'
import { TypeSelector, TypeBadge } from '../components/TripTypeIcons'
import { IconChevronLeft, IconCheck, IconPlus, IconSignal } from '../components/icons'

function toLocalISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const STEP_LABELS = ['Basics', 'Rig', 'People', 'Review']

const PREPARE_ITEMS = [
  { label: 'Fire & evac data',           status: 'Cached',    color: 'var(--safe)'           },
  { label: 'Offline map tiles',          status: 'Cached',    color: 'var(--safe)'           },
  { label: 'Weather window',             status: 'Fetching',  color: 'var(--warn)'           },
  { label: 'Burn ban status',            status: 'Fetching',  color: 'var(--warn)'           },
  { label: 'Meal plan suggestions',      status: 'On create', color: 'var(--text-tertiary)'  },
  { label: 'Private land boundary data', status: 'On create', color: 'var(--text-tertiary)'  },
]

const INITIAL_FORM = {
  name: '',
  types: [],
  departureDate: '',
  returnDate: '',
  region: '',
  gear: { summer: true, photography: false },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreateTripPage({ onClose, onCreated }) {
  const [step, setStep]       = useState(1)
  const [form, setForm]       = useState(() => ({
    ...INITIAL_FORM,
    departureDate: toLocalISODate(new Date()),
  }))
  const [creating, setCreating] = useState(false)
  const [error, setError]     = useState(null)
  const { createTrip } = useAppStore()

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }))
  const updateGear = (key, val) => setForm(prev => ({ ...prev, gear: { ...prev.gear, [key]: val } }))

  const goBack = () => step > 1 ? setStep(s => s - 1) : onClose()
  const goNext = () => step < 4 ? setStep(s => s + 1) : handleCreate()

  const handleCreate = async () => {
    setCreating(true)
    setError(null)
    try {
      await createTrip({
        name:          form.name || 'New Trip',
        type:          form.types[0] ?? 'Overlanding',
        types:         form.types,
        departureDate: form.departureDate || toLocalISODate(new Date()),
        returnDate:    form.returnDate    || null,
        region:        form.region,
      })
      onCreated()
    } catch (err) {
      console.error('Create trip error:', err)
      setError('Failed to create trip. Try again.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <StepHeader step={step} onBack={goBack} onNext={goNext} creating={creating} />
      <div className="flex-1 overflow-y-auto">
        {step === 1 && <Step1Basics  form={form} update={update} />}
        {step === 2 && <Step2Rig     form={form} updateGear={updateGear} />}
        {step === 3 && <Step3People />}
        {step === 4 && <Step4Review  form={form} onEdit={() => setStep(1)} onCreate={handleCreate} creating={creating} error={error} />}
      </div>
    </div>
  )
}

// ─── Shared header ────────────────────────────────────────────────────────────

function StepHeader({ step, onBack, onNext, creating }) {
  const { accent } = useAppStore()
  return (
    <div style={{ paddingTop: 'max(12px, env(safe-area-inset-top))', paddingRight: '16px', paddingBottom: 0, paddingLeft: '16px', borderBottom: '1px solid var(--border)' }}>
      {/* Step counter */}
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
        STEP {String(step).padStart(2, '0')} · OF 04
      </p>

      {/* Nav row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button
          onClick={onBack}
          style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <IconChevronLeft style={{ width: 20, height: 20, color: 'var(--text-primary)' }} />
        </button>

        <span style={{ fontFamily: 'var(--font-body)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>New Trip</span>

        <button
          onClick={onNext}
          disabled={creating}
          style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: creating ? 'var(--text-tertiary)' : accent, padding: '0 4px' }}
        >
          {step === 4 ? (creating ? 'Creating…' : 'Create') : 'Next'}
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? accent : 'var(--border)', transition: 'background 0.3s' }}
          />
        ))}
      </div>

      {/* Step labels */}
      <div style={{ display: 'flex', paddingBottom: 10 }}>
        {STEP_LABELS.map((l, i) => (
          <p
            key={l}
            style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: i + 1 === step ? accent : 'var(--text-tertiary)', transition: 'color 0.2s', textTransform: 'uppercase' }}
          >
            {l}
          </p>
        ))}
      </div>
    </div>
  )
}

// ─── Step 1 — Basics ──────────────────────────────────────────────────────────

function Step1Basics({ form, update }) {
  const { accent } = useAppStore()
  return (
    <div className="p-4 flex flex-col gap-5" style={{ paddingBottom: 'calc(32px + env(safe-area-inset-bottom))' }}>

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
        <div className="flex gap-3">
          <DateField
            label="Depart"
            value={form.departureDate}
            onChange={v => update('departureDate', v)}
          />
          <DateField
            label="Return"
            value={form.returnDate}
            onChange={v => update('returnDate', v)}
            placeholder="Select date"
            minDate={form.departureDate}
          />
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

    </div>
  )
}

function DateField({ label, value, onChange, placeholder = 'Select date', minDate }) {
  const inputRef = useRef(null)
  const displayDate = value
    ? (() => { const [y, m, d] = value.split('-').map(Number); return new Date(y, m - 1, d) })()
    : null
  const formatted = displayDate
    ? displayDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : placeholder

  return (
    <div className="flex-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 py-3">
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{label}</p>
      <button
        type="button"
        onClick={() => {
          if (inputRef.current?.showPicker) {
            inputRef.current.showPicker()
          } else {
            inputRef.current?.click()
          }
        }}
        style={{
          width: '100%', background: 'transparent', border: 'none', padding: 0,
          fontSize: 15, fontWeight: 600,
          color: value ? 'var(--text-primary)' : 'var(--text-tertiary)',
          fontFamily: 'var(--font-body)', textAlign: 'left', cursor: 'pointer',
        }}
      >
        {formatted}
      </button>
      <input
        ref={inputRef}
        type="date"
        value={value || ''}
        min={minDate || undefined}
        onChange={e => onChange(e.target.value || '')}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
      />
    </div>
  )
}

// ─── Step 2 — Rig ─────────────────────────────────────────────────────────────

function Step2Rig({ form, updateGear }) {
  return (
    <div className="p-4 flex flex-col gap-5" style={{ paddingBottom: 'calc(32px + env(safe-area-inset-bottom))' }}>

      <Field label="Vehicle">
        {/* Selected vehicle */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden divide-y divide-[var(--border)]">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-center shrink-0">
              <IconSignal style={{ width: 16, height: 16, color: 'var(--text-secondary)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)]">2014 Jeep JKU — Chomp</p>
              <p className="text-xs text-[var(--text-secondary)]">Primary rig</p>
            </div>
            <IconCheck style={{ width: 16, height: 16, color: '#22c55e', flexShrink: 0 }} />
          </div>
          <button className="w-full flex items-center gap-3 px-4 py-3 active:opacity-60 transition-opacity">
            <div className="w-8 h-8 rounded-lg border border-dashed border-[var(--border)] flex items-center justify-center shrink-0">
              <IconPlus style={{ width: 14, height: 14, color: 'var(--text-tertiary)' }} />
            </div>
            <span className="text-sm text-[var(--text-tertiary)]">Add vehicle</span>
          </button>
        </div>
      </Field>

      <Field label="Gear lists">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden divide-y divide-[var(--border)]">
          <GearToggleRow
            label="5-day summer overlanding"
            count={42}
            on={form.gear.summer}
            onToggle={() => updateGear('summer', !form.gear.summer)}
          />
          <GearToggleRow
            label="Photography add-on"
            count={6}
            on={form.gear.photography}
            onToggle={() => updateGear('photography', !form.gear.photography)}
          />
        </div>
      </Field>

      <Field label="Fuel estimate">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden divide-y divide-[var(--border)]">
          <FuelRow label="Route distance"  value="~240mi round trip"     />
          <FuelRow label="Fuel needed"     value="~20 gal + 3 gal reserve" />
          <FuelRow label="Last fuel stop"  value="Entiat · 34mi out"     />
        </div>
      </Field>

    </div>
  )
}

function GearToggleRow({ label, count, on, onToggle }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        <p className="text-xs text-[var(--text-secondary)]">{count} items</p>
      </div>
      <Toggle on={on} onToggle={onToggle} />
    </div>
  )
}

function FuelRow({ label, value }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      <span className="text-sm font-medium text-[var(--text-primary)]">{value}</span>
    </div>
  )
}

// ─── Step 3 — People ──────────────────────────────────────────────────────────

function Step3People() {
  const { accent, user, profile } = useAppStore()
  const displayName = getDisplayName(profile, user, 'You')
  const initials    = getInitials(profile, user)
  return (
    <div className="p-4 flex flex-col gap-5" style={{ paddingBottom: 'calc(32px + env(safe-area-inset-bottom))' }}>

      <Field label="Partners">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden divide-y divide-[var(--border)]">
          {/* Current user — fixed */}
          <div className="flex items-center gap-3 px-4 py-3">
            <Avatar initials={initials} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)]">{displayName}</p>
              <p className="text-xs text-[var(--text-secondary)]">You · Trip lead</p>
            </div>
          </div>
          {/* Emily */}
          <div className="flex items-center gap-3 px-4 py-3">
            <Avatar initials="EB" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)]">Emily Brown</p>
              <p className="text-xs text-[var(--text-secondary)]">emily@gmail.com</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 text-[var(--text-primary)]" style={{ background: accent }}>
              Co-pilot
            </span>
          </div>
          {/* Invite */}
          <GhostRow label="Invite by email or link" />
        </div>
      </Field>

      <Field label="Campsites">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden divide-y divide-[var(--border)]">
          <CampsiteRow
            name="Handy Spring"
            sub="Dispersed · FR 5900"
            pinColor={accent}
            badge="Open"
            badgeColor="#22c55e"
            badgeBg="rgba(34,197,94,0.12)"
            badgeBorder="rgba(34,197,94,0.25)"
          />
          <CampsiteRow
            name="Entiat River Camp"
            sub="Rec.gov #482193"
            pinColor="#3b82f6"
            badge="Reserved"
            badgeColor="#60a5fa"
            badgeBg="rgba(59,130,246,0.12)"
            badgeBorder="rgba(59,130,246,0.25)"
          />
          <GhostRow label="Add campsite" />
        </div>
      </Field>

      <Field label="Pets">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
          <GhostRow label="Add a pet" />
        </div>
      </Field>

    </div>
  )
}

function Avatar({ initials }) {
  return (
    <div className="w-8 h-8 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center shrink-0">
      <span className="text-[10px] font-bold text-[var(--text-secondary)]">{initials}</span>
    </div>
  )
}

function CampsiteRow({ name, sub, pinColor, badge, badgeColor, badgeBg, badgeBorder }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" style={{ color: pinColor }}>
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.75" />
        <circle cx="12" cy="9" r="2.5" fill="currentColor" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)]">{name}</p>
        <p className="text-xs text-[var(--text-secondary)]">{sub}</p>
      </div>
      <span
        className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
        style={{ color: badgeColor, background: badgeBg, border: `1px solid ${badgeBorder}` }}
      >
        {badge}
      </span>
    </div>
  )
}

function GhostRow({ label }) {
  return (
    <button className="w-full flex items-center gap-3 px-4 py-3 active:opacity-60 transition-opacity">
      <div className="w-5 h-5 rounded-full border border-dashed border-[var(--border)] flex items-center justify-center shrink-0">
        <IconPlus style={{ width: 10, height: 10, color: 'var(--text-tertiary)' }} />
      </div>
      <span className="text-sm text-[var(--text-tertiary)]">{label}</span>
    </button>
  )
}

// ─── Step 4 — Review ──────────────────────────────────────────────────────────

function Step4Review({ form, onEdit, onCreate, creating, error }) {
  const { accent, user, profile } = useAppStore()
  const gearCount   = (form.gear.summer ? 42 : 0) + (form.gear.photography ? 6 : 0)
  const displayName = getDisplayName(profile, user, 'You')

  return (
    <div className="p-4 flex flex-col gap-5" style={{ paddingBottom: 'calc(32px + env(safe-area-inset-bottom))' }}>

      {/* Summary card */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <p className="text-base font-bold text-[var(--text-primary)]">{form.name || 'New Trip'}</p>
          <button onClick={onEdit} className="text-xs font-semibold active:opacity-60" style={{ color: accent }}>
            Edit
          </button>
        </div>
        {form.types.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 16px 12px' }}>
            {form.types.map(t => <TypeBadge key={t} type={t} />)}
          </div>
        )}
        <div className="divide-y divide-[var(--border)]">
          <ReviewRow label="Dates"     value={form.departureDate ? (form.returnDate ? `${fmtDate(form.departureDate)} → ${fmtDate(form.returnDate)}` : fmtDate(form.departureDate)) : '—'} />
          <ReviewRow label="Region"    value={form.region || '—'} />
          <ReviewRow label="Vehicle"   value="2014 Jeep JKU · Chomp" />
          <ReviewRow label="People"    value={`${displayName}, Emily Brown`} />
          <ReviewRow label="Campsites" value="Handy Spring, Entiat River" />
          <ReviewRow label="Gear"      value={`${gearCount} items`} />
        </div>
      </div>

      <div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>VELA will prepare</p>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden divide-y divide-[var(--border)]">
          {PREPARE_ITEMS.map(item => (
            <div key={item.label} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-[var(--text-secondary)]">{item.label}</span>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: item.color }} />
                <span className="text-xs font-semibold" style={{ color: item.color }}>{item.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2.5">
        {error && (
          <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 13, color: '#f87171', fontFamily: 'var(--font-body)' }}>
            {error}
          </div>
        )}
        <button
          onClick={onCreate}
          disabled={creating}
          className="w-full py-4 rounded-xl text-sm font-bold active:opacity-80 transition-opacity"
          style={{ background: creating ? 'var(--border)' : accent, color: creating ? 'var(--text-tertiary)' : '#fff', cursor: creating ? 'default' : 'pointer' }}
        >
          {creating ? 'Creating…' : 'Create trip'}
        </button>
        <button className="w-full py-4 rounded-xl text-sm font-semibold text-[var(--text-secondary)] border border-[var(--border)] active:opacity-60 transition-opacity">
          Save as draft
        </button>
      </div>

    </div>
  )
}

function ReviewRow({ label, value }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-xs text-[var(--text-secondary)]">{label}</span>
      <span className="text-sm font-medium text-[var(--text-primary)] text-right max-w-[60%]">{value}</span>
    </div>
  )
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{label}</p>
      {children}
    </div>
  )
}

function Toggle({ on, onToggle }) {
  const { accent } = useAppStore()
  return (
    <div
      onClick={onToggle}
      className="relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 cursor-pointer select-none"
      style={{ background: on ? accent : 'var(--border)' }}
    >
      <div
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{ transform: on ? 'translateX(22px)' : 'translateX(2px)' }}
      />
    </div>
  )
}

function fmtDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
