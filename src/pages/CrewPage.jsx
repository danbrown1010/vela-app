import { useState, useEffect } from 'react'
import { IconPeople, IconX } from '../components/icons'
import { useCrew } from '../hooks/useCrew'
import { useAppStore } from '../store/index'
import { UserAvatar } from '../components/UserAvatar'
import { StatusBadge } from '../components/StatusBadge'
import { supabase } from '../lib/supabase'

const ROLE_COLORS = {
  pilot: 'var(--accent)',
  copilot: 'var(--safe)',
  observer: 'var(--text-tertiary)',
}

const ROLE_LABELS = {
  pilot: 'PILOT',
  copilot: 'COPILOT',
  observer: 'OBSERVER',
}

export default function CrewPage({ onBack }) {
  const { user, isPro } = useAppStore()
  const {
    crew, members, pendingInvites,
    loading, isPilot,
    createCrew, inviteMember,
    removeMember, acceptInvite,
    declineInvite, reload,
  } = useCrew()

  const [view, setView] = useState('main')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('copilot')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState(null)
  const [inviteSuccess, setInviteSuccess] = useState(null)
  const [crewName, setCrewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [acceptToast, setAcceptToast] = useState(null)
  const [watchPassword, setWatchPassword] = useState('')
  const [passwordHint, setPasswordHint] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)

  useEffect(() => {
    if (crew) {
      setWatchPassword(crew.watch_password ?? '')
      setPasswordHint(crew.watch_password_hint ?? '')
    }
  }, [crew?.id])

  const saveWatchPassword = async () => {
    if (!watchPassword.trim()) return
    setSavingPassword(true)
    const { error } = await supabase
      .from('crews')
      .update({
        watch_password: watchPassword.trim().toUpperCase(),
        watch_password_hint: passwordHint.trim() || null,
      })
      .eq('id', crew.id)
      .eq('pilot_id', user.id)
    if (!error) {
      setPasswordSaved(true)
      setTimeout(() => setPasswordSaved(false), 2000)
      await reload()
    }
    setSavingPassword(false)
  }

  const handleCreateCrew = async () => {
    if (!crewName.trim()) return
    setCreating(true)
    try {
      await createCrew(crewName.trim())
      setView('main')
    } catch (err) {
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteError(null)
    setInviteSuccess(null)
    try {
      const p = await inviteMember(inviteEmail.trim(), inviteRole)
      setInviteSuccess(`Invite sent to ${p.name || inviteEmail}`)
      setInviteEmail('')
    } catch (err) {
      setInviteError(err.message)
    } finally {
      setInviting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)', position: 'relative' }}>

      {acceptToast && (
        <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: 'var(--safe)', color: '#fff', padding: '10px 20px', borderRadius: 24, fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {acceptToast}
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 20, padding: 0 }}>
          ←
        </button>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
            My Crew
          </div>
          {crew && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              {crew.name} · {members.filter(m => m.status === 'accepted').length} members
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {/* Pending invites received */}
        {pendingInvites.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Pending invites
            </div>
            {pendingInvites.map(invite => (
              <div key={invite.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--accent)', borderRadius: 12, padding: '12px 14px', marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', marginBottom: 2 }}>
                  {invite.crews?.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', marginBottom: 10 }}>
                  Invited as {invite.role} by {invite.crews?.profiles?.name || 'Unknown'}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={async () => {
                      const crewName = invite.crews?.name
                      await acceptInvite(invite.id)
                      setAcceptToast(`Welcome to ${crewName}! You are now a copilot.`)
                      setTimeout(() => setAcceptToast(null), 3500)
                    }}
                    style={{ flex: 1, padding: 8, borderRadius: 8, border: 'none', background: 'var(--safe)', color: '#fff', fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-body)', cursor: 'pointer' }}
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => declineInvite(invite.id)}
                    style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontFamily: 'var(--font-body)', cursor: 'pointer' }}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No crew yet */}
        {!crew && (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <IconPeople style={{ width: 48, height: 48, color: 'var(--accent)', marginBottom: 16 }} />
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', marginBottom: 8 }}>No crew yet</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', lineHeight: 1.6, margin: '0 auto 24px', maxWidth: 280 }}>
              Create a crew and invite copilots to join your expeditions.
            </div>
            {view !== 'create' && (
              <button
                onClick={() => setView('create')}
                style={{ background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '12px 24px', color: '#fff', fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer' }}
              >
                Create a crew
              </button>
            )}
          </div>
        )}

        {/* Create crew form */}
        {view === 'create' && !crew && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', marginBottom: 14 }}>
              Name your crew
            </div>
            <input
              value={crewName}
              onChange={e => setCrewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateCrew()}
              placeholder="e.g. Team Chomp"
              style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setView('main')}
                style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 14, fontFamily: 'var(--font-body)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCrew}
                disabled={!crewName.trim() || creating}
                style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: crewName.trim() ? 'var(--accent)' : 'var(--border)', color: crewName.trim() ? '#fff' : 'var(--text-tertiary)', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: crewName.trim() ? 'pointer' : 'default' }}
              >
                {creating ? 'Creating...' : 'Create crew'}
              </button>
            </div>
          </div>
        )}

        {/* Crew exists */}
        {crew && (
          <>
            {/* Crew header card */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>{crew.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                  {isPilot ? 'YOU ARE PILOT' : 'CREW MEMBER'}
                </div>
              </div>
              <StatusBadge status={isPilot ? 'safe' : 'monitor'} label={isPilot ? 'PILOT' : 'MEMBER'} />
            </div>

            {/* Accepted members */}
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Members · {members.filter(m => m.status === 'accepted').length}
            </div>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
              {members.filter(m => m.status === 'accepted').map((member, i, arr) => (
                <div key={member.id} style={{ padding: '10px 14px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <UserAvatar profile={member.profiles} user={null} size={32} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
                      {member.profiles?.name || member.profiles?.email}
                      {member.user_id === user?.id && ' (you)'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}>
                      {member.profiles?.email}
                    </div>
                  </div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: ROLE_COLORS[member.role], letterSpacing: '0.06em' }}>
                    {ROLE_LABELS[member.role]}
                  </div>
                  {isPilot && member.role !== 'pilot' && (
                    <button
                      onClick={() => removeMember(member.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0 4px' }}
                    >
                      <IconX style={{ width: 14, height: 14 }} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Pending invites sent (pilot view) */}
            {isPilot && members.filter(m => m.status === 'pending').length > 0 && (
              <>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Pending invites
                </div>
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
                  {members.filter(m => m.status === 'pending').map((member, i, arr) => (
                    <div key={member.id} style={{ padding: '10px 14px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>?</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
                          {member.profiles?.name || member.profiles?.email || member.guest_email || 'Guest observer'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>INVITE PENDING</div>
                      </div>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: ROLE_COLORS[member.role], letterSpacing: '0.06em' }}>
                        {ROLE_LABELS[member.role]}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Invite form — pilots only */}
            {/* Observer access / watch password — pilot only */}
            {isPilot && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Observer access
                </div>
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', lineHeight: 1.6, marginBottom: 12 }}>
                    Set a crew password that observers use to watch your published trips at{' '}
                    <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>vela-go.com/watch</span>
                  </div>
                  <input
                    value={watchPassword}
                    onChange={e => setWatchPassword(e.target.value.toUpperCase())}
                    placeholder="e.g. PINE-RIDGE"
                    maxLength={20}
                    style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, letterSpacing: '0.08em', outline: 'none', boxSizing: 'border-box', marginBottom: 8, textTransform: 'uppercase' }}
                  />
                  <input
                    value={passwordHint}
                    onChange={e => setPasswordHint(e.target.value)}
                    placeholder="Hint for observers (optional)"
                    style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
                  />
                  {crew?.watch_password && (
                    <div style={{ background: 'rgba(74,124,63,0.1)', border: '1px solid var(--safe)', borderRadius: 8, padding: '10px 12px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--safe)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Current password</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>{crew.watch_password}</div>
                      </div>
                      <button
                        onClick={() => navigator.clipboard.writeText(`Watch ${crew.name} on VELA:\nvela-go.com/watch\nPassword: ${crew.watch_password}`)}
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer' }}
                      >
                        Copy share text
                      </button>
                    </div>
                  )}
                  <button
                    onClick={saveWatchPassword}
                    disabled={!watchPassword.trim() || savingPassword}
                    style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: watchPassword.trim() ? passwordSaved ? 'var(--safe)' : 'var(--accent)' : 'var(--border)', color: watchPassword.trim() ? '#fff' : 'var(--text-tertiary)', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: watchPassword.trim() ? 'pointer' : 'default', transition: 'background 0.2s' }}
                  >
                    {savingPassword ? 'Saving...' : passwordSaved ? '✓ Saved' : crew?.watch_password ? 'Update password' : 'Set password'}
                  </button>
                </div>
              </div>
            )}

            {isPilot && (
              <>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Invite to crew
                </div>
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 8 }}>
                  {/* Role selector */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    {['copilot', 'observer'].map(role => (
                      <button
                        key={role}
                        onClick={() => setInviteRole(role)}
                        style={{
                          flex: 1, padding: 7, borderRadius: 8,
                          border: `1px solid ${inviteRole === role ? ROLE_COLORS[role] : 'var(--border)'}`,
                          background: inviteRole === role ? `${ROLE_COLORS[role]}22` : 'transparent',
                          color: inviteRole === role ? ROLE_COLORS[role] : 'var(--text-tertiary)',
                          fontSize: 12, fontWeight: inviteRole === role ? 600 : 400,
                          fontFamily: 'var(--font-body)', cursor: 'pointer', textTransform: 'capitalize',
                        }}
                      >
                        {role}
                      </button>
                    ))}
                  </div>

                  {/* Role description */}
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', marginBottom: 10, lineHeight: 1.5 }}>
                    {inviteRole === 'observer'
                      ? 'Read-only trip tracking. No VELA account needed — they watch via a share link when a trip goes active.'
                      : 'Can edit trips and waypoints. Must have a VELA account. Free for 1st copilot, PRO for more.'}
                  </div>

                  {/* Email input */}
                  <input
                    value={inviteEmail}
                    onChange={e => { setInviteEmail(e.target.value); setInviteError(null); setInviteSuccess(null) }}
                    onKeyDown={e => e.key === 'Enter' && handleInvite()}
                    placeholder="Email address"
                    type="email"
                    style={{ width: '100%', background: 'var(--bg-secondary)', border: `1px solid ${inviteError ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 8, padding: '10px 12px', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }}
                  />

                  {inviteError && (
                    <div style={{ fontSize: 12, color: 'var(--danger)', fontFamily: 'var(--font-body)', marginBottom: 8, lineHeight: 1.5 }}>
                      {inviteError}
                    </div>
                  )}

                  {inviteSuccess && (
                    <div style={{ fontSize: 12, color: 'var(--safe)', fontFamily: 'var(--font-body)', marginBottom: 8 }}>
                      ✓ {inviteSuccess}
                    </div>
                  )}

                  <button
                    onClick={handleInvite}
                    disabled={!inviteEmail.trim() || inviting}
                    style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', background: inviteEmail.trim() && !inviting ? 'var(--accent)' : 'var(--border)', color: inviteEmail.trim() ? '#fff' : 'var(--text-tertiary)', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: inviteEmail.trim() ? 'pointer' : 'default' }}
                  >
                    {inviting ? 'Sending...' : `Send ${inviteRole} invite`}
                  </button>
                </div>

                {/* PRO upsell */}
                {!isPro && members.filter(m => m.role === 'copilot' && m.status === 'accepted').length >= 1 && (
                  <div style={{ background: 'rgba(196,82,26,0.1)', border: '1px solid var(--accent)', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--font-body)', lineHeight: 1.5 }}>
                    Upgrade to PRO to add more copilots. Observers are always free.
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
