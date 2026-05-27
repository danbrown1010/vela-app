import { useState, useEffect, lazy, Suspense } from 'react'
import { useAuth } from './hooks/useAuth'
import { AppProvider, useAppStore } from './store/index'
import { useSyncOnLogin } from './hooks/useSyncOnLogin'
import { usePositionBroadcast } from './hooks/usePositionBroadcast'
import { supabase } from './lib/supabase'
import { getPendingDeletes, removePendingDelete, getPendingSaves, removePendingSave } from './utils/gearStorage'
import { getPendingTripSaves, removePendingTripSave, getPendingTripDeletes, removePendingTripDelete } from './utils/tripStorage'
import { syncGearToSupabase, deleteGearFromSupabase, syncTripToSupabase, deleteTripFromSupabase } from './utils/syncManager'
import BottomNav from './components/BottomNav'
import HomePage from './pages/HomePage'
import AuthPage from './pages/AuthPage'
import DevRibbon from './components/DevRibbon'
import ErrorBoundary from './components/ErrorBoundary'
import BugReportButton from './components/BugReportButton'
import PendingSyncIndicator from './components/PendingSyncIndicator'
import PendingSyncPanel from './components/PendingSyncPanel'
import { BackgroundProvider } from './contexts/BackgroundContext'
import { HaTokenProvider } from './store/haTokenStore'
import { HaUnlockModal } from './components/HaUnlockModal'
import { HaTokenSetupModal } from './components/HaTokenSetupModal'
import { runLoginSync } from './hooks/useSyncOnLogin'
import { RigStatusProvider } from './store/rigStatus'
import { HaProbeRunner } from './components/HaProbeRunner'

const TripPage         = lazy(() => import('./pages/TripPage'))
const SafetyPage       = lazy(() => import('./pages/SafetyPage'))
const RigPage          = lazy(() => import('./pages/RigPage'))
const MorePage         = lazy(() => import('./pages/MorePage'))
const CreateTripPage   = lazy(() => import('./pages/CreateTripPage'))
const EditTripPage     = lazy(() => import('./pages/EditTripPage'))
const SettingsPage     = lazy(() => import('./pages/SettingsPage'))
const SurvivalAgentPage = lazy(() => import('./pages/SurvivalAgentPage'))
const KnowledgeBasePage = lazy(() => import('./pages/KnowledgeBasePage'))
const MealPlanningPage = lazy(() => import('./pages/MealPlanningPage'))
const GearRegistryPage = lazy(() => import('./pages/GearRegistryPage'))
const CrewPage         = lazy(() => import('./pages/CrewPage'))
const PetsPage         = lazy(() => import('./pages/PetsPage'))
const GloveBoxPage     = lazy(() => import('./pages/GloveBoxPage'))
const FleetPage        = lazy(() => import('./pages/FleetPage'))

function AppContent() {
  const { user, profile, signInWithGoogle, signOut, loading: authLoading, notAllowed } = useAuth()

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(var(--vh, 1svh) * 100)', background: 'var(--bg-primary)' }}>
        <img src="/vela-lockup.png" alt="VELA" height={28} style={{ height: 28, width: 'auto', maxWidth: 'none', display: 'block' }} />
      </div>
    )
  }

  if (!user) {
    return (
      <BackgroundProvider>
        <AuthPage onSignIn={signInWithGoogle} notAllowed={notAllowed} />
      </BackgroundProvider>
    )
  }

  return (
    <HaTokenProvider userId={user.id}>
      <AppProvider user={user} profile={profile} signOut={signOut} signInWithGoogle={signInWithGoogle}>
        <AppShell user={user} />
        <BugReportButton />
      </AppProvider>
    </HaTokenProvider>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
      <DevRibbon />
    </ErrorBoundary>
  )
}

function AppShell({ user }) {
  const { setSyncStatus, setProfile, theme } = useAppStore()
  const [toast, setToast] = useState(null)
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3500) }
  const [showSyncPanel, setShowSyncPanel] = useState(false)

  useSyncOnLogin(user, setSyncStatus, showToast)
  usePositionBroadcast()

  useEffect(() => {
    const meta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
    if (!meta) return
    meta.setAttribute('content', theme === 'parchment' ? 'default' : 'black-translucent')
  }, [theme])

  const [haSetupOpen, setHaSetupOpen] = useState(false)

  useEffect(() => {
    const handler = () => setHaSetupOpen(true)
    window.addEventListener('vela:ha-setup-needed', handler)
    return () => window.removeEventListener('vela:ha-setup-needed', handler)
  }, [])

  const showHaSetup = haSetupOpen

  // Handle Stripe redirect returns
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    if (params.get('upgraded') === 'true') {
      window.history.replaceState({}, '', window.location.pathname)
      if (user) {
        supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
          .then(({ data }) => {
            if (data) {
              setProfile(data)
              showToast('Welcome to VELA PRO!')
            }
          })
      }
    }

    if (params.get('cancelled') === 'true') {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [user])

  useEffect(() => {
    const handleOnline = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return
        const userId = session.user.id

        for (const id of getPendingTripDeletes()) {
          const { error } = await deleteTripFromSupabase(id)
          if (!error) removePendingTripDelete(id)
        }

        for (const trip of Object.values(getPendingTripSaves())) {
          const { error } = await syncTripToSupabase(trip, userId)
          if (!error) removePendingTripSave(trip.id)
        }

        for (const id of getPendingDeletes()) {
          const { error } = await deleteGearFromSupabase(id)
          if (!error) removePendingDelete(id)
        }

        for (const item of Object.values(getPendingSaves())) {
          const { error } = await syncGearToSupabase(item, userId)
          if (!error) removePendingSave(item.id)
        }
      } catch (err) {
        console.error('Online sync error:', err)
        showToast('Reconnect sync failed — changes will retry on next login.')
      }
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  const [activeTab,             setActiveTab]             = useState('home')
  const [showCreate,            setShowCreate]            = useState(false)
  const [editingTrip,           setEditingTrip]           = useState(null)
  const [moreSubview,           setMoreSubview]           = useState(null)
  const [showSettings,          setShowSettings]          = useState(false)
  const [closingSettings,       setClosingSettings]       = useState(false)
  const [pendingSettingsSection, setPendingSettingsSection] = useState(null)
  const [safetyFocus,           setSafetyFocus]           = useState(null)

  const closeSettings = () => {
    setClosingSettings(true)
    setTimeout(() => { setShowSettings(false); setClosingSettings(false) }, 240)
  }

  const openCreate  = () => setShowCreate(true)
  const closeCreate = () => setShowCreate(false)
  const openEdit    = (trip) => setEditingTrip(trip)
  const closeEdit   = () => setEditingTrip(null)

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setMoreSubview(null)
    closeSettings()
  }

  // Handle vela:open-settings deep-link events
  useEffect(() => {
    const handler = (e) => {
      setPendingSettingsSection(e.detail?.section ?? null)
      setShowSettings(true)
    }
    window.addEventListener('vela:open-settings', handler)
    return () => window.removeEventListener('vela:open-settings', handler)
  }, [])

  // Handle vela:navigate-safety — fired by ThreatHeadline ActionButtons
  useEffect(() => {
    const handler = (e) => {
      setActiveTab('safety')
      setSafetyFocus(e.detail?.focus ?? null)
    }
    window.addEventListener('vela:navigate-safety', handler)
    return () => window.removeEventListener('vela:navigate-safety', handler)
  }, [])

  // Handle vela:open-sync-panel deep-link from SettingsPage
  useEffect(() => {
    const handler = () => setShowSyncPanel(true)
    window.addEventListener('vela:open-sync-panel', handler)
    return () => window.removeEventListener('vela:open-sync-panel', handler)
  }, [])

  // Handle ?invite=xxx deep link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const inviteId = params.get('invite')
    if (inviteId && user) {
      window.history.replaceState({}, '', window.location.pathname)
      setActiveTab('more')
      setMoreSubview('crew')
      showToast('You have a crew invite waiting!')
    }
  }, [user])

  return (
    <RigStatusProvider>
    <HaProbeRunner />
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-primary)',
      height: 'calc(var(--vh, 1svh) * 100)',
      position: 'relative',
    }}>
      {toast && (
        <div style={{
          position: 'absolute', top: 'calc(16px + env(safe-area-inset-top))',
          left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, pointerEvents: 'none',
          background: 'var(--accent)', color: '#fff',
          padding: '10px 20px', borderRadius: 24,
          fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}

      <Suspense fallback={null}>
      {showCreate ? (
        <CreateTripPage
          onClose={closeCreate}
          onCreated={() => { closeCreate(); setActiveTab('home') }}
        />
      ) : editingTrip ? (
        <EditTripPage trip={editingTrip} onClose={closeEdit} />
      ) : (
        <>
          <div key={activeTab + (moreSubview ?? '')} className="page-enter" style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
            {activeTab === 'home'   && <HomePage onPlanTrip={openCreate} onEditTrip={openEdit} onNavigateToDocs={() => { setActiveTab('more'); setMoreSubview('glove-box') }} />}
            {activeTab === 'trip'   && <TripPage />}
            {activeTab === 'safety' && <SafetyPage focus={safetyFocus} onFocusConsumed={() => setSafetyFocus(null)} />}
            {activeTab === 'rig'    && <RigPage />}
            {activeTab === 'pets'   && <PetsPage />}
            {activeTab === 'more'   && moreSubview === null        && <MorePage          onNavigate={setMoreSubview} />}
            {activeTab === 'more'   && moreSubview === 'survival'  && <SurvivalAgentPage onBack={() => setMoreSubview(null)} />}
            {activeTab === 'more'   && moreSubview === 'knowledge' && <KnowledgeBasePage onBack={() => setMoreSubview(null)} />}
            {activeTab === 'more'   && moreSubview === 'meals'     && <MealPlanningPage  onBack={() => setMoreSubview(null)} />}
            {activeTab === 'more'   && moreSubview === 'gear'      && <GearRegistryPage  onBack={() => setMoreSubview(null)} />}
            {activeTab === 'more'   && moreSubview === 'crew'        && <CrewPage          onBack={() => setMoreSubview(null)} />}
            {activeTab === 'more'   && moreSubview === 'pets'        && <PetsPage          onBack={() => setMoreSubview(null)} />}
            {activeTab === 'more'   && moreSubview === 'glove-box'   && <GloveBoxPage      onBack={() => setMoreSubview(null)} />}
            {activeTab === 'more'   && moreSubview === 'fleet'        && <FleetPage         onBack={() => setMoreSubview(null)} />}
          </div>
          <BottomNav active={activeTab} onChange={handleTabChange} />
        </>
      )}

      {/* Settings overlay */}
      {showSettings && (
        <>
          <div
            onClick={closeSettings}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 190, backdropFilter: 'blur(2px)' }}
          />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0,
            width: 'min(420px, 100vw)',
            background: 'var(--bg-primary)',
            borderLeft: '1px solid var(--border)',
            zIndex: 195,
            display: 'flex', flexDirection: 'column',
            animation: closingSettings ? 'slideOutRight 0.24s ease-in forwards' : 'slideInRight 0.25s ease-out',
          }}>
            <div style={{
              padding: '16px 16px 12px',
              paddingTop: 'max(16px, env(safe-area-inset-top))',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                Settings
              </div>
              <button
                onClick={closeSettings}
                aria-label="Close settings"
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <SettingsPage
                embedded
                onClose={closeSettings}
                onNavigateTab={handleTabChange}
                pendingSection={pendingSettingsSection}
                onConsumePendingSection={() => setPendingSettingsSection(null)}
              />
            </div>
          </div>
        </>
      )}
      </Suspense>

      <HaUnlockModal />
      {showHaSetup && (
        <HaTokenSetupModal
          onClose={() => setHaSetupOpen(false)}
        />
      )}

      <PendingSyncIndicator onOpen={() => setShowSyncPanel(true)} />
      {showSyncPanel && (
        <PendingSyncPanel
          user={user}
          onClose={() => setShowSyncPanel(false)}
          onRetry={() => runLoginSync(user, setSyncStatus, showToast)}
          showToast={showToast}
        />
      )}
    </div>
    </RigStatusProvider>
  )
}
