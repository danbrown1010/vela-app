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

export default function App() {
  const { user, profile, isPro, signInWithGoogle, signOut, loading: authLoading, notAllowed } = useAuth()

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(var(--vh, 1svh) * 100)', background: 'var(--bg-primary)' }}>
        <svg width="48" height="48" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="100" rx="20" fill="#243020"/>
          <g fill="var(--text-primary)">
            <path d="M50 5C41.7 5 35 11.7 35 20c0 11.5 15 28 15 28s15-16.5 15-28C65 11.7 58.3 5 50 5zM50 26c-3.3 0-6-2.7-6-6s2.7-6 6-6s6 2.7 6 6-2.7 6-6 6z"/>
            <path d="M2 92L30 38L45 63L38 73L53 92H2z"/>
            <path d="M98 92L70 45L55 65L62 75L47 92H98z"/>
            <path d="M46 92C46 92 47 78 50 70C53 62 57 59 55 52C53 45 49 48 49 48" fill="none" stroke="var(--bg-primary)" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>
          </g>
        </svg>
      </div>
    )
  }

  if (!user) {
    return <AuthPage onSignIn={signInWithGoogle} notAllowed={notAllowed} />
  }

  return (
    <AppProvider user={user} profile={profile} signOut={signOut} signInWithGoogle={signInWithGoogle}>
      <AppShell user={user} />
    </AppProvider>
  )
}

function AppShell({ user }) {
  const { setSyncStatus, setProfile } = useAppStore()
  useSyncOnLogin(user, setSyncStatus)
  usePositionBroadcast()

  const [toast, setToast] = useState(null)
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3500) }

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
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  const [activeTab,             setActiveTab]             = useState('home')
  const [showCreate,            setShowCreate]            = useState(false)
  const [editingTrip,           setEditingTrip]           = useState(null)
  const [moreSubview,           setMoreSubview]           = useState(null)
  const [showSettings,          setShowSettings]          = useState(false)
  const [pendingSettingsSection, setPendingSettingsSection] = useState(null)

  const openCreate  = () => setShowCreate(true)
  const closeCreate = () => setShowCreate(false)
  const openEdit    = (trip) => setEditingTrip(trip)
  const closeEdit   = () => setEditingTrip(null)

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setMoreSubview(null)
    setShowSettings(false)
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
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-primary)',
      height: 'calc(var(--vh, 1svh) * 100)',
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)',
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
      {/* Side-pull settings tab */}
      {user && (
        <div
          onClick={() => setShowSettings(s => !s)}
          style={{
            position: 'fixed',
            right: showSettings ? -1 : 0,
            top: 0,
            zIndex: 200,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'flex-start',
            transition: 'right 0.25s ease-out',
          }}
        >
          <div style={{
            background: showSettings ? 'var(--accent)' : 'var(--bg-card)',
            border: `1px solid ${showSettings ? 'var(--accent)' : 'var(--border)'}`,
            borderRight: 'none',
            borderTop: 'none',
            borderRadius: '0 0 0 8px',
            width: 34,
            height: 'calc(env(safe-area-inset-top, 0px) + 52px)',
            paddingTop: 'env(safe-area-inset-top, 0px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            boxShadow: '-2px 2px 8px rgba(0,0,0,0.2)',
            transition: 'background 0.2s, border-color 0.2s',
          }}>
            {/* Gear icon */}
            <svg viewBox="0 0 24 24" fill="none"
              stroke={showSettings ? '#fff' : 'var(--text-secondary)'}
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                width: 15, height: 15,
                transition: 'transform 0.3s',
                transform: showSettings ? 'rotate(90deg)' : 'none',
                flexShrink: 0,
              }}>
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>

            {/* Pull indicator chevron — always rendered to prevent gear jump */}
            <svg viewBox="0 0 24 24" fill="none"
              stroke="var(--text-tertiary)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                width: 8, height: 8,
                flexShrink: 0,
                opacity: showSettings ? 0 : 1,
                animation: showSettings ? 'none' : 'pulseLeft 2s ease-in-out infinite',
                transition: 'opacity 0.2s',
              }}>
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </div>
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
            {activeTab === 'safety' && <SafetyPage />}
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
            onClick={() => setShowSettings(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 190, backdropFilter: 'blur(2px)' }}
          />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0,
            width: 'min(420px, 100vw)',
            background: 'var(--bg-primary)',
            borderLeft: '1px solid var(--border)',
            zIndex: 195,
            display: 'flex', flexDirection: 'column',
            animation: 'slideInRight 0.25s ease-out',
          }}>
            <div style={{
              padding: '16px 16px 12px',
              paddingTop: 'max(16px, env(safe-area-inset-top))',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              display: 'flex', alignItems: 'center',
              flexShrink: 0,
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                Settings
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <SettingsPage
                embedded
                onClose={() => setShowSettings(false)}
                onNavigateTab={handleTabChange}
                pendingSection={pendingSettingsSection}
                onConsumePendingSection={() => setPendingSettingsSection(null)}
              />
            </div>
          </div>
        </>
      )}
      </Suspense>
    </div>
  )
}
