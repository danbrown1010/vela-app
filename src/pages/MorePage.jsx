import { useState } from 'react'
import { StatusBadge } from '../components/StatusBadge'
import { useAppStore } from '../store/index'
import { UserAvatar } from '../components/UserAvatar'
import { CollapsingHeader } from '../components/CollapsingHeader'
import {
  IconPeople, IconPaw, IconShield, IconBook,
  IconStar, IconBackpack, IconUtensils,
  IconBell, IconFolder,
  IconSignal, IconChevronRight,
} from '../components/icons'

const SECTIONS = [
  {
    label: 'Expedition',
    items: [
      { id: 'fleet',  title: 'Fleet',    sub: 'Vehicles · maintenance · build sheet', Icon: IconSignal },
      { id: 'crew',   title: 'My Crew',  sub: 'Invite copilots and observers',        Icon: IconPeople },
      { id: 'badges', title: 'Badges',   sub: 'Your trail record',                    Icon: IconStar   },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { id: 'survival',  title: 'Survival Agent', sub: 'AI wilderness expert', Icon: IconShield, pro: true },
      { id: 'knowledge', title: 'Knowledge Base', sub: 'Manuals, RAG search',  Icon: IconBook,   pro: true },
      { id: 'campbot',   title: 'Campsite Bot',   sub: 'Availability alerts',  Icon: IconBell,   pro: true },
    ],
  },
  {
    label: 'Gear & Prep',
    items: [
      { id: 'glove-box',   title: 'Glove Box',         sub: 'Permits · reservations · insurance', Icon: IconFolder   },
      { id: 'gear',        title: 'Gear & Packing',   sub: 'Checklists, fish & game',            Icon: IconBackpack },
      { id: 'meals',       title: 'Meal Planning',    sub: 'AI off-grid meals',                  Icon: IconUtensils },
      { id: 'pets',        title: 'Pets',             sub: 'Care, food, vets',                   Icon: IconPaw      },
    ],
  },
]

export default function MorePage({ onNavigate }) {
  const { user, profile, pendingInviteCount, location, gpsStatus } = useAppStore()
  const displayName = profile?.name || user?.user_metadata?.full_name || user?.email || 'User'
  const gpsState = gpsStatus === 'locked' ? 'locked' : (gpsStatus === 'requesting' || gpsStatus === 'ip-based') ? 'searching' : 'off'
  const gpsAccuracyM = Math.round(location?.accuracy ?? 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      <CollapsingHeader
        image={{ node: <UserAvatar profile={profile} user={user} size={40} />, shape: 'circle' }}
        title={displayName}
        subtitle={user?.email ?? ''}
        uppercaseTitle={false}
        badge={{ label: 'PRO', tone: 'success' }}
        gps={{ state: gpsState, accuracyM: gpsAccuracyM }}
        onOpenSettings={() => window.dispatchEvent(new CustomEvent('vela:open-settings', { detail: {} }))}
      />

      <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>

        {/* Pending crew invites banner */}
        {pendingInviteCount > 0 && (
          <div
            onClick={() => onNavigate('crew')}
            style={{ background: 'rgba(196,82,26,0.12)', border: '1px solid var(--accent)', borderRadius: 10, padding: '10px 14px', marginBottom: -4, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
          >
            <IconPeople style={{ width: 18, height: 18, color: 'var(--accent)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', fontFamily: 'var(--font-body)' }}>
                {pendingInviteCount} crew invite{pendingInviteCount > 1 ? 's' : ''} pending
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}>Tap to view and accept</div>
            </div>
            <IconChevronRight style={{ width: 14, height: 14, color: 'var(--text-tertiary)' }} />
          </div>
        )}

        {SECTIONS.map(s => (
          <Section key={s.label} label={s.label}>
            {s.items.map(item => (
              <ItemRow
                key={item.id}
                title={item.title}
                sub={item.sub}
                Icon={item.Icon}
                pro={item.pro}
                onTap={() => onNavigate && onNavigate(item.id)}
              />
            ))}
          </Section>
        ))}
      </div>
      </div>
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{children}</p>
  )
}

function Section({ label, children }) {
  const [open, setOpen] = useState(true)
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between"
        style={{ marginBottom: open ? 8 : 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</p>
        <IconChevronRight style={{ width: 14, height: 14, color: 'var(--text-tertiary)', flexShrink: 0, transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
      </button>
      {open && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function ItemRow({ title, sub, Icon, pro, onTap }) {
  return (
    <button
      onClick={onTap}
      className="w-full text-left active:opacity-70 transition-opacity"
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}
    >
      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon style={{ width: 18, height: 18, color: 'var(--text-secondary)' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</p>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</p>
      </div>
      {pro ? (
        <StatusBadge status="advisory" label="PRO" dot={false} />
      ) : (
        <IconChevronRight style={{ width: 16, height: 16, color: 'var(--text-tertiary)', flexShrink: 0 }} />
      )}
    </button>
  )
}
