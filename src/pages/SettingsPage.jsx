import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { IconChevronLeft, IconChevronRight, IconCheck, IconZap, IconMap, IconWifi, IconCog, IconBook, IconPaw } from '../components/icons'
import { useAppStore } from '../store/index'
import { saveAnthropicKey, clearAnthropicKey, hasAnthropicKey } from '../utils/secretsManager'
import { UserAvatar } from '../components/UserAvatar'
import { getFirstName } from '../utils/userHelpers'
import { StatusBadge } from '../components/StatusBadge'
import { useEcoflowConfig } from '../hooks/useEcoflowConfig'

const CONNECTED_APPS = [
  { id: 'onx',      title: 'OnX Offroad', sub: 'Maps & route planning'  },
  { id: 'gaia',     title: 'Gaia GPS',    sub: 'Topo + satellite layers' },
  { id: 'ecoflow',  title: 'EcoFlow',     sub: 'Power station telemetry' },
  { id: 'starlink', title: 'Starlink',    sub: 'Satellite internet'      },
]


// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENTS = [
  '#C4521A', // terra-cotta (default)
  '#3b82f6', // blue
  '#4A7C3F', // forest green
  '#a855f7', // purple
  '#d97706', // amber
  '#94a3b8', // slate
]

const FREQ_OPTIONS = [
  { id: 'battery',  label: 'Battery saver', desc: 'Every 5 minutes',  proOnly: false },
  { id: 'standard', label: 'Standard',      desc: 'Every 60 seconds', proOnly: false },
  { id: 'live',     label: 'Live · PRO',    desc: 'Every 10 seconds', proOnly: true  },
]

const STARLINK_PROXY = import.meta.env.VITE_STARLINK_PROXY || null
const HA_URL         = import.meta.env.VITE_HA_URL         || null

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage({ onBack, onNavigateTab, onClose, embedded = false, pendingSection, onConsumePendingSection }) {
  const [subPage, setSubPage] = useState(null)
  const { accent, setAccent, theme, setTheme, user, profile, isPro, signOut, petsEnabled, setPetsEnabled, tripLabels, setTripLabels } = useAppStore()

  if (subPage === 'connectedApps') return <ConnectedAppsPage onBack={() => setSubPage(null)} onNavigateTab={onNavigateTab} />

  const [keySet, setKeySet]           = useState(() => !!localStorage.getItem('vela-anthropic-key'))
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [keySaving, setKeySaving]     = useState(false)
  const [toast, setToast]             = useState('')

  useEffect(() => {
    hasAnthropicKey(user?.id).then(setKeySet)
  }, [user?.id])

  const [pets, setPets] = useState([])
  useEffect(() => {
    if (!user?.id) return
    supabase.from('pets').select('id,name,photo_url').eq('user_id', user.id).order('created_at', { ascending: true }).then(({ data }) => {
      if (data) setPets(data)
    })
  }, [user?.id])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const handleSaveKey = async () => {
    if (!apiKeyInput.trim().startsWith('sk-ant-') || !user?.id) return
    setKeySaving(true)
    try {
      const success = await saveAnthropicKey(apiKeyInput.trim(), user.id)
      if (success) {
        setKeySet(true)
        setApiKeyInput('')
        showToast('AI features enabled ✓')
      } else {
        showToast('Failed to save key — try again')
      }
    } finally {
      setKeySaving(false)
    }
  }

  const handleClearKey = async () => {
    await clearAnthropicKey(user?.id)
    setKeySet(false)
    showToast('API key removed')
  }

  const [updateFrequency, setUpdateFrequency] = useState(
    () => localStorage.getItem('vela-position-frequency') ?? 'standard'
  )
  const [showProNote, setShowProNote]   = useState(false)
  const [starlinkSheet, setStarlinkSheet] = useState(false)
  const [haSheet, setHaSheet]             = useState(false)
  const [ecoflowSheet, setEcoflowSheet]   = useState(false)
  const [haUrl, setHaUrl]     = useState(() => localStorage.getItem('vela-ha-url') ?? '')
  const [haToken, setHaToken] = useState(() => localStorage.getItem('vela-ha-token') ?? '')

  useEffect(() => {
    if (!pendingSection) return
    if (pendingSection === 'starlink') {
      setStarlinkSheet(true)
      onConsumePendingSection?.()
    } else if (pendingSection === 'ecoflow') {
      setEcoflowSheet(true)
      onConsumePendingSection?.()
    } else if (pendingSection === 'home_assistant') {
      setHaSheet(true)
      onConsumePendingSection?.()
    }
  }, [pendingSection, onConsumePendingSection])

  const handleFrequencyTap = (opt) => {
    if (opt.proOnly && !isPro) {
      setUpdateFrequency('standard')
      localStorage.setItem('vela-position-frequency', 'standard')
      setShowProNote(true)
      setTimeout(() => setShowProNote(false), 3000)
    } else {
      setUpdateFrequency(opt.id)
      localStorage.setItem('vela-position-frequency', opt.id)
      setShowProNote(false)
    }
  }

  const [tripToggles, setTripToggles] = useState({
    phaseAware:        true,
    autoDetect:        true,
    postTripReminders: true,
  })

  const [notifToggles, setNotifToggles] = useState({
    fire:         true,
    burnBan:      true,
    privateLand:  true,
    campsite:     false,
    checkIn:      true,
  })

  const toggleTrip  = (k) => setTripToggles(p  => ({ ...p,  [k]: !p[k]  }))
  const toggleNotif = (k) => setNotifToggles(p => ({ ...p, [k]: !p[k] }))

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 flex flex-col gap-5" style={{ paddingBottom: 'calc(32px + env(safe-area-inset-bottom))' }}>

        {/* Header — hidden in embedded (overlay has its own header) */}
        {!embedded && (
          <div style={{ paddingTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={onBack}
              style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', flexShrink: 0 }}
            >
              <IconChevronLeft style={{ width: 16, height: 16, color: 'var(--text-primary)' }} />
            </button>
            <h1 style={{ fontFamily: 'var(--font-body)', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Settings</h1>
          </div>
        )}

        {/* ── Account ─────────────────────────────────────────────────────────── */}
        <Section label="Account" defaultOpen>
          {/* Profile header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <UserAvatar profile={profile} user={user} size={48} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.name || user?.user_metadata?.full_name || 'User'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email}
              </div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: profile?.plan === 'pro' ? 'var(--accent)' : 'var(--text-tertiary)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {profile?.plan === 'pro' ? '● PRO' : '● FREE'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>Household</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <UserAvatar profile={profile} user={user} size={26} />
                <div style={{ marginLeft: -8 }}>
                  <UserAvatar profile={{ name: 'Emily' }} size={26} />
                </div>
                {pets.map((pet, i) => (
                  <div key={pet.id} style={{ marginLeft: -8 }}>
                    <PetAvatar pet={pet} size={26} />
                  </div>
                ))}
              </div>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
                {[getFirstName(profile, user, 'You'), 'Emily', ...pets.map(p => p.name)].join(' + ')}
              </span>
            </div>
          </div>
          <AccountRow label="Active Vehicle"  value="2014 Jeep JKU — Chomp" />
          <button
            className="w-full flex items-center px-4 py-3 active:opacity-70 transition-opacity"
            onClick={async () => {
              await signOut()
              onClose?.()
            }}
          >
            <span className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>Sign out</span>
          </button>
        </Section>

        {/* ── Integrations ────────────────────────────────────────────────── */}
        <Section label="Integrations">
          {/* Anthropic API key */}
          <div className="px-4 py-3 flex flex-col gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
            {toast && (
              <div style={{
                padding: '8px 12px', borderRadius: 8,
                background: toast.includes('✓') ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${toast.includes('✓') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                fontSize: 12, fontFamily: 'var(--font-body)',
                color: toast.includes('✓') ? '#22c55e' : '#f87171',
              }}>
                {toast}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Anthropic API key</p>
                <p style={{ fontSize: 11, color: keySet ? '#22c55e' : 'var(--text-tertiary)', marginTop: 2 }}>
                  {keySet ? 'Configured' : 'Not configured'}
                </p>
              </div>
              {keySet && (
                <button
                  onClick={handleClearKey}
                  style={{
                    fontSize: 12, padding: '5px 12px', borderRadius: 20,
                    border: '1px solid var(--border)', background: 'transparent',
                    color: '#ef4444', fontFamily: 'var(--font-body)', cursor: 'pointer',
                  }}
                >
                  Clear
                </button>
              )}
            </div>
            {!keySet && (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="password"
                  placeholder="sk-ant-..."
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
                  style={{
                    flex: 1, background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)', borderRadius: 10,
                    padding: '9px 12px', color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none',
                  }}
                />
                <button
                  onClick={handleSaveKey}
                  disabled={!apiKeyInput.trim().startsWith('sk-ant-') || keySaving}
                  style={{
                    padding: '9px 16px', borderRadius: 10, border: 'none',
                    background: apiKeyInput.trim().startsWith('sk-ant-') && !keySaving ? accent : 'var(--border)',
                    color: apiKeyInput.trim().startsWith('sk-ant-') && !keySaving ? '#fff' : 'var(--text-tertiary)',
                    fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
                    cursor: apiKeyInput.trim().startsWith('sk-ant-') && !keySaving ? 'pointer' : 'default',
                    flexShrink: 0, transition: 'background 0.15s',
                  }}
                >
                  {keySaving ? 'Saving…' : 'Save API Key'}
                </button>
              </div>
            )}
          </div>
          <IntegrationRow Icon={IconWifi}  title="Starlink"        sub="Dish telemetry"            badge={{ status: 'soon', label: 'SOON' }} onTap={undefined} />
          <IntegrationRow
              Icon={IconZap}
              title="EcoFlow"
              sub="Power station telemetry"
              badge={{ status: 'linked', label: 'LINKED' }}
              onTap={() => setEcoflowSheet(true)}
            />
          <IntegrationRow Icon={IconMap}   title="OnX Offroad"     sub="Maps & route planning"     badge={{ status: 'linked', label: 'LINKED' }} onTap={() => window.open('https://www.onxmaps.com/offroad/app', '_blank')} />
          <IntegrationRow Icon={IconBook}  title="Gaia GPS"        sub="Topo + satellite layers"   badge={{ status: 'linked', label: 'LINKED' }} onTap={() => window.open('https://www.gaiagps.com', '_blank')} />
          <IntegrationRow Icon={IconCog}   title="Home Assistant"  sub="Vehicle sensors & network"  badge={{ status: HA_URL ? 'linked' : 'off', label: HA_URL ? 'CONFIGURED' : 'NOT SET' }} onTap={() => setHaSheet(true)} last />
        </Section>

        {/* ── Notifications ───────────────────────────────────────────────────── */}
        <Section label="Notifications">
          <ToggleRow label="Fire alerts"            on={notifToggles.fire}        onToggle={() => toggleNotif('fire')}        />
          <ToggleRow label="Burn ban changes"       on={notifToggles.burnBan}     onToggle={() => toggleNotif('burnBan')}     />
          <ToggleRow label="Private land warnings"  on={notifToggles.privateLand} onToggle={() => toggleNotif('privateLand')} />
          <ToggleRow label="Campsite availability"  on={notifToggles.campsite}    onToggle={() => toggleNotif('campsite')}    />
          <ToggleRow label="Check-in reminders"     on={notifToggles.checkIn}     onToggle={() => toggleNotif('checkIn')}     />
        </Section>

        {/* ── Features ────────────────────────────────────────────────────── */}
        <Section label="Features">
          <ToggleRow
            label="Pet companion"
            sub="Trail profiles for your dogs"
            on={petsEnabled}
            onToggle={() => setPetsEnabled(!petsEnabled)}
          />
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>Position update frequency</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, fontFamily: 'var(--font-body)' }}>How often your location is shared during active trips</p>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {FREQ_OPTIONS.map(opt => {
                const selected = updateFrequency === opt.id
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleFrequencyTap(opt)}
                    style={{
                      flex: 1, padding: '7px 4px', borderRadius: 8, textAlign: 'center',
                      border: `1px solid ${selected ? accent : 'var(--border)'}`,
                      background: selected ? `${accent}20` : 'var(--bg-secondary)',
                      color: selected ? accent : 'var(--text-secondary)',
                      fontSize: 11, fontWeight: selected ? 600 : 400,
                      fontFamily: 'var(--font-body)', cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
            <p style={{ fontSize: 11, fontFamily: 'var(--font-body)', color: showProNote ? accent : 'var(--text-tertiary)' }}>
              {showProNote ? 'Live updates require PRO' : FREQ_OPTIONS.find(o => o.id === updateFrequency)?.desc}
            </p>
          </div>
          <ToggleRow
            label="Phase-aware home screen"
            sub="Adapt dashboard to trip phase"
            on={tripToggles.phaseAware}
            onToggle={() => toggleTrip('phaseAware')}
          />
          <ToggleRow
            label="Auto-detect on-trip"
            sub="Use GPS + trip dates"
            on={tripToggles.autoDetect}
            onToggle={() => toggleTrip('autoDetect')}
          />
          <ToggleRow
            label="Post-trip reminders"
            sub="Media sync, trail reports"
            on={tripToggles.postTripReminders}
            onToggle={() => toggleTrip('postTripReminders')}
          />
        </Section>

        {/* ── Appearance ─────────────────────────────────────────────────────── */}
        <Section label="Appearance">
          <div className="px-4 py-3 flex flex-col gap-3">
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Theme</p>
            <div className="flex gap-3">
              <ThemeCard label="Dark"  selected={theme === 'dark'}  onSelect={() => setTheme('dark')}  preview={<DarkPreview />}  />
              <ThemeCard label="Light" selected={theme === 'light'} onSelect={() => setTheme('light')} preview={<LightPreview />} />
            </div>
          </div>
          <div className="px-4 py-3 flex items-center justify-between">
            <p className="text-sm font-medium text-[var(--text-primary)]">Accent color</p>
            <div className="flex items-center gap-2">
              {ACCENTS.map(c => (
                <button
                  key={c}
                  onClick={() => setAccent(c)}
                  className="w-6 h-6 rounded-full transition-transform active:scale-90"
                  style={{
                    background: c,
                    boxShadow: accent === c ? `0 0 0 2px var(--bg-primary), 0 0 0 4px ${c}` : 'none',
                    transform: accent === c ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>
          <ToggleRow
            label="Trip labels"
            sub="Show type name on trip badges"
            on={tripLabels}
            onToggle={() => setTripLabels(!tripLabels)}
          />
        </Section>

        {/* ── About ───────────────────────────────────────────────────────────── */}
        <Section label="About">
          <a
              href="https://danbrown1010.github.io/chomp-docs"
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-between px-4 py-3 active:opacity-70 transition-opacity"
            >
              <span className="text-sm font-medium text-[var(--text-primary)]">Knowledge base</span>
              <IconChevronRight style={{ width: 16, height: 16, color: 'var(--text-tertiary)' }} />
            </a>
          <AccountRow label="Subscription" value={profile?.plan === 'pro' ? 'Pro' : 'Free'} valueColor={profile?.plan === 'pro' ? 'var(--accent)' : undefined} />
          {isPro && (
            <button
              className="w-full flex items-center justify-between px-4 py-3 active:opacity-70 transition-opacity"
              onClick={() => window.open('https://billing.stripe.com/p/login/5kQ9AT2zygVuf4ZfOzaAw00', '_blank')}
            >
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontWeight: 500 }}>Manage subscription</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', marginTop: 1 }}>Billing · Cancel · Receipts</div>
              </div>
              <IconChevronRight style={{ width: 16, height: 16, color: 'var(--text-tertiary)', flexShrink: 0 }} />
            </button>
          )}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-[var(--text-secondary)]">Version</span>
            <span className="text-sm font-medium text-[var(--text-primary)]">0.1.0 — Phase 3 build</span>
          </div>
        </Section>

      </div>

      {/* ── Starlink bottom sheet ─────────────────────────────────────────────── */}
      {starlinkSheet && (
        <div onClick={() => setStarlinkSheet(false)} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: 'var(--bg-card)', borderRadius: '20px 20px 0 0', border: '1px solid var(--border)', borderBottom: 'none', padding: '24px 20px', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 20px' }} />
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', marginBottom: 4 }}>Starlink Proxy</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', marginBottom: 20, lineHeight: 1.5 }}>Run the starlink-proxy server on your Mac Mini or Raspberry Pi connected to your Starlink router.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Proxy URL</div>
                <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: STARLINK_PROXY ? 'var(--text-primary)' : 'var(--text-tertiary)', wordBreak: 'break-all' }}>{STARLINK_PROXY || 'Not configured'}</div>
              </div>
              <button onClick={() => window.open('https://github.com/danbrown1010/vela-app', '_blank')} style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer', textAlign: 'center' }} className="active:opacity-70 transition-opacity">
                View setup guide →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EcoFlow device picker sheet ──────────────────────────────────────── */}
      {ecoflowSheet && (
        <EcoflowDevicePickerSheet
          accent={accent}
          userId={user?.id}
          onClose={() => setEcoflowSheet(false)}
        />
      )}

      {/* ── Home Assistant bottom sheet ───────────────────────────────────────── */}
      {haSheet && (
        <div onClick={() => setHaSheet(false)} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: 'var(--bg-card)', borderRadius: '20px 20px 0 0', border: '1px solid var(--border)', borderBottom: 'none', padding: '24px 20px', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 20px' }} />
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', marginBottom: 4 }}>Home Assistant</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', marginBottom: 20, lineHeight: 1.5 }}>Connect to your HA instance on the Chomp WiFi network.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                value={haUrl}
                onChange={e => setHaUrl(e.target.value)}
                placeholder="http://homeassistant.local:8123"
                style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
              />
              <input
                value={haToken}
                onChange={e => setHaToken(e.target.value)}
                placeholder="Long-lived access token"
                type="password"
                style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setHaSheet(false)}
                  style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    localStorage.setItem('vela-ha-url', haUrl)
                    localStorage.setItem('vela-ha-token', haToken)
                    setHaSheet(false)
                  }}
                  style={{ flex: 2, padding: 8, borderRadius: 8, border: 'none', background: accent, color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer' }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Theme cards ──────────────────────────────────────────────────────────────

function ThemeCard({ label, selected, onSelect, preview }) {
  const { accent } = useAppStore()
  return (
    <button
      onClick={onSelect}
      className="flex-1 rounded-xl overflow-hidden border-2 transition-colors active:opacity-80"
      style={{ borderColor: selected ? accent : 'var(--border)' }}
    >
      {preview}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ background: label === 'Light' ? '#E8E4D9' : '#1C2117' }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: label === 'Light' ? '#1C2117' : '#F0EDE4' }}>{label}</span>
        {selected && (
          <IconCheck style={{ width: 14, height: 14, color: accent }} />
        )}
      </div>
    </button>
  )
}

function DarkPreview() {
  return (
    <div className="h-16 p-2 flex flex-col gap-1.5" style={{ background: '#1C2117' }}>
      <div className="h-2 rounded" style={{ background: '#3A4A32', width: '70%' }} />
      <div className="h-1.5 rounded" style={{ background: '#242B1E', width: '45%' }} />
      <div className="flex gap-1.5 mt-0.5">
        <div className="h-5 w-9 rounded" style={{ background: '#C4521A' }} />
        <div className="h-5 flex-1 rounded border" style={{ background: '#2A3323', borderColor: '#3A4A32' }} />
      </div>
    </div>
  )
}

function LightPreview() {
  return (
    <div className="h-16 p-2 flex flex-col gap-1.5" style={{ background: '#E8E4D9' }}>
      <div className="h-2 rounded" style={{ background: '#C8C3B5', width: '70%' }} />
      <div className="h-1.5 rounded" style={{ background: '#DDD8CC', width: '45%' }} />
      <div className="flex gap-1.5 mt-0.5">
        <div className="h-5 w-9 rounded" style={{ background: '#C4521A' }} />
        <div className="h-5 flex-1 rounded border" style={{ background: '#F0EDE4', borderColor: '#C8C3B5' }} />
      </div>
    </div>
  )
}

// ─── Shared components ────────────────────────────────────────────────────────

function Section({ label, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between"
        style={{ marginBottom: open ? 8 : 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</p>
        <IconChevronRight style={{ width: 14, height: 14, color: 'var(--text-tertiary)', flexShrink: 0, transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
      </button>
      {open && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }} className="divide-y divide-[var(--border)]">
          {children}
        </div>
      )}
    </div>
  )
}

function ToggleRow({ label, sub, on, onToggle }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        {sub && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{sub}</p>}
      </div>
      <Toggle on={on} onToggle={onToggle} />
    </div>
  )
}

function PetAvatar({ pet, size = 26 }) {
  const [imgError, setImgError] = useState(false)
  if (pet.photo_url && !imgError) {
    return (
      <img
        src={pet.photo_url}
        alt={pet.name}
        onError={() => setImgError(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1.5px solid var(--border)' }}
      />
    )
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--bg-secondary)', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <IconPaw style={{ width: Math.round(size * 0.55), height: Math.round(size * 0.55), color: 'var(--text-tertiary)' }} />
    </div>
  )
}

function IntegrationRow({ Icon, title, sub, badge, onTap, last }) {
  return (
    <button
      onClick={onTap}
      disabled={!onTap}
      className="w-full active:opacity-70 transition-opacity"
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', textAlign: 'left', background: 'transparent',
        borderBottom: last ? 'none' : '1px solid var(--border)',
        cursor: onTap ? 'pointer' : 'default',
        opacity: onTap ? 1 : 0.6,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon style={{ width: 18, height: 18, color: 'var(--text-secondary)' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>{title}</p>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, fontFamily: 'var(--font-body)' }}>{sub}</p>
      </div>
      <StatusBadge status={badge.status} label={badge.label} dot={false} />
    </button>
  )
}

function AccountRow({ label, value, valueColor, onTap }) {
  return (
    <button onClick={onTap} className="w-full flex items-center justify-between px-4 py-3 active:opacity-70 transition-opacity">
      <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm" style={{ color: valueColor || 'var(--text-secondary)' }}>{value}</span>
        <IconChevronRight style={{ width: 16, height: 16, color: 'var(--text-tertiary)', flexShrink: 0 }} />
      </div>
    </button>
  )
}

// ─── Connected Apps sub-page ──────────────────────────────────────────────────


function ConnectedAppsPage({ onBack, onNavigateTab }) {
  const [starlinkSheet, setStarlinkSheet] = useState(false)

  const handleTap = (id) => {
    if (id === 'onx')      window.open('https://www.onxmaps.com/offroad/app', '_blank')
    if (id === 'gaia')     window.open('https://www.gaiagps.com', '_blank')
    if (id === 'ecoflow')  onNavigateTab?.('rig')
    if (id === 'starlink') setStarlinkSheet(true)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 flex flex-col gap-5" style={{ paddingBottom: 'calc(32px + env(safe-area-inset-bottom))' }}>
        <div style={{ paddingTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onBack}
            style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', flexShrink: 0 }}
          >
            <IconChevronLeft style={{ width: 16, height: 16, color: 'var(--text-primary)' }} />
          </button>
          <h1 style={{ fontFamily: 'var(--font-body)', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Connected Apps</h1>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          {CONNECTED_APPS.map((app, i) => (
            <button
              key={app.id}
              onClick={() => handleTap(app.id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', width: '100%', textAlign: 'left',
                borderBottom: i < CONNECTED_APPS.length - 1 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                background: 'transparent',
              }}
              className="active:opacity-70 transition-opacity"
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>{app.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, fontFamily: 'var(--font-body)' }}>{app.sub}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <StatusBadge status="linked" label="LINKED" dot={false} />
                <IconChevronRight style={{ width: 16, height: 16, color: 'var(--text-tertiary)' }} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Starlink bottom sheet */}
      {starlinkSheet && (
        <div
          onClick={() => setStarlinkSheet(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', background: 'var(--bg-card)', borderRadius: '20px 20px 0 0', border: '1px solid var(--border)', borderBottom: 'none', padding: '24px 20px', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 20px' }} />
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', marginBottom: 4 }}>Starlink</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', marginBottom: 20 }}>Satellite internet · connection info</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>Status</span>
                <StatusBadge status={STARLINK_PROXY ? 'linked' : 'danger'} label={STARLINK_PROXY ? 'CONNECTED' : 'OFFLINE'} dot={false} />
              </div>

              {STARLINK_PROXY && (
                <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Proxy URL</div>
                  <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{STARLINK_PROXY}</div>
                </div>
              )}

              {!STARLINK_PROXY && (
                <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>To enable proxy</div>
                  <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', lineHeight: 1.7 }}>
                    1. Connect to Starlink network{'\n'}
                    2. Run the proxy on your laptop{'\n'}
                    3. Set VITE_STARLINK_PROXY in .env
                  </div>
                </div>
              )}

              <button
                onClick={() => window.open('https://www.starlink.com', '_blank')}
                style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer', textAlign: 'center' }}
                className="active:opacity-70 transition-opacity"
              >
                starlink.com →
              </button>
            </div>
          </div>
        </div>
      )}
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

// ─── EcoFlow device picker sheet ──────────────────────────────────────────────

function EcoflowDevicePickerSheet({ accent, userId, onClose }) {
  const {
    allDevices,
    visibleDeviceIds,
    featuredDeviceId,
    featuredDevice,
    toggle,
    setFeatured,
    loaded,
  } = useEcoflowConfig(userId)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxHeight: '85vh', overflowY: 'auto',
          background: 'var(--bg-card)',
          borderRadius: '20px 20px 0 0',
          border: '1px solid var(--border)', borderBottom: 'none',
          padding: '24px 20px',
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
        }}
      >
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'var(--border)', margin: '0 auto 20px',
        }} />

        <div style={{
          fontSize: 18, fontWeight: 700,
          color: 'var(--text-primary)', fontFamily: 'var(--font-body)', marginBottom: 4,
        }}>
          EcoFlow Devices
        </div>
        <div style={{
          fontSize: 13, color: 'var(--text-secondary)',
          fontFamily: 'var(--font-body)', marginBottom: 20, lineHeight: 1.5,
        }}>
          Check devices to show in the Power section. Tap the radio dot to choose which one is featured.
        </div>

        {!loaded && (
          <div style={{
            fontSize: 12, color: 'var(--text-tertiary)',
            fontFamily: 'var(--font-body)', textAlign: 'center', padding: 16,
          }}>
            Loading…
          </div>
        )}

        {loaded && allDevices.map((device) => {
          const checked = visibleDeviceIds.includes(device.id)
          const isFeatured = featuredDeviceId === device.id

          return (
            <div
              key={device.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', marginBottom: 8,
                background: 'var(--bg-secondary)',
                borderRadius: 10,
                border: `1px solid ${checked ? `${accent}99` : 'var(--border)'}`,
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              {/* Checkbox — toggles visibility */}
              <button
                onClick={() => toggle(device.id)}
                aria-label={checked ? `Hide ${device.name}` : `Show ${device.name}`}
                style={{
                  width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                  border: `1.5px solid ${checked ? accent : 'var(--border)'}`,
                  background: checked ? accent : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', padding: 0,
                  transition: 'all 0.15s',
                }}
                className="active:opacity-70 transition-opacity"
              >
                {checked && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                       stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>

              {/* Featured radio — only enabled when checked */}
              <button
                onClick={() => { if (checked) setFeatured(device.id) }}
                disabled={!checked}
                aria-label={isFeatured ? `${device.name} is featured` : `Make ${device.name} featured`}
                title={checked ? (isFeatured ? 'Featured device' : 'Make featured') : 'Enable device first'}
                style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  border: `1.5px solid ${isFeatured ? accent : 'var(--border)'}`,
                  background: 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: checked ? 'pointer' : 'not-allowed',
                  opacity: checked ? 1 : 0.35,
                  padding: 0,
                  transition: 'all 0.15s',
                }}
                className="active:opacity-70 transition-opacity"
              >
                {isFeatured && (
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: accent,
                  }} />
                )}
              </button>

              {/* Label */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 600,
                  color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {device.name}
                  </span>
                  {isFeatured && checked && (
                    <span style={{
                      fontSize: 9, fontFamily: 'var(--font-mono)',
                      fontWeight: 700, letterSpacing: '0.08em',
                      color: accent,
                      border: `1px solid ${accent}66`,
                      padding: '1px 5px', borderRadius: 4,
                      flexShrink: 0,
                    }}>
                      FEATURED
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: 11, color: 'var(--text-tertiary)',
                  fontFamily: 'var(--font-body)', marginTop: 2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {device.model}
                  {device.capacity > 0 ? ` · ${device.capacity.toLocaleString()} Wh` : ''}
                </div>
              </div>
            </div>
          )
        })}

        <div style={{
          fontSize: 11, fontFamily: 'var(--font-mono)',
          color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 12,
        }}>
          {visibleDeviceIds.length} of {allDevices.length} selected
          {featuredDevice ? ` · ${featuredDevice.name} featured` : ''}
        </div>
      </div>
    </div>
  )
}
