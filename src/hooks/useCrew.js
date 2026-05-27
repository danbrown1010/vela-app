import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/index'

export function useCrew() {
  const { user, setPendingInviteCount } = useAppStore()
  const [crew, setCrew] = useState(null)
  const [members, setMembers] = useState([])
  const [pendingInvites, setPendingInvites] = useState([])
  const [loading, setLoading] = useState(true)

  const loadCrew = async () => {
    try {
      const { data: pilotCrew, error: e1 } = await supabase
        .from('crews')
        .select('*')
        .eq('pilot_id', user.id)
        .maybeSingle()

      if (e1) console.error('Crew query error:', e1)

      if (pilotCrew) {
        setCrew(pilotCrew)

        const { data: crewMembers } = await supabase
          .from('crew_members')
          .select('*')
          .eq('crew_id', pilotCrew.id)

        const memberIds = (crewMembers ?? []).map(m => m.user_id).filter(Boolean)

        let profiles = []
        if (memberIds.length > 0) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id, name, email, avatar_url, plan')
            .in('id', memberIds)
          profiles = profileData ?? []
        }

        const enriched = (crewMembers ?? []).map(m => ({
          ...m,
          profiles: profiles.find(p => p.id === m.user_id) ?? null,
        }))

        setMembers(enriched)
        setLoading(false)
        return
      }

      const { data: membership } = await supabase
        .from('crew_members')
        .select('*, crew_id')
        .eq('user_id', user.id)
        .eq('status', 'accepted')
        .maybeSingle()

      if (membership) {
        const { data: crewData } = await supabase
          .from('crews')
          .select('*')
          .eq('id', membership.crew_id)
          .single()

        if (crewData) setCrew(crewData)
      }
    } catch (err) {
      console.error('loadCrew error:', err)
    }
    setLoading(false)
  }

  const loadPendingInvites = async () => {
    try {
      const { data: invites } = await supabase
        .from('crew_members')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')

      if (!invites || invites.length === 0) {
        setPendingInvites([])
        setPendingInviteCount(0)
        return
      }

      const crewIds = invites.map(i => i.crew_id)
      const { data: crews } = await supabase
        .from('crews')
        .select('*')
        .in('id', crewIds)

      const pilotIds = (crews ?? []).map(c => c.pilot_id)
      const { data: pilots } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url')
        .in('id', pilotIds)

      const enriched = invites.map(invite => ({
        ...invite,
        crews: {
          ...(crews ?? []).find(c => c.id === invite.crew_id),
          profiles: (pilots ?? []).find(
            p => p.id === (crews ?? []).find(c => c.id === invite.crew_id)?.pilot_id
          ),
        },
      }))

      setPendingInvites(enriched)
      setPendingInviteCount(enriched.length)
    } catch (err) {
      console.error('Pending invites error:', err)
      setPendingInvites([])
      setPendingInviteCount(0)
    }
  }

  useEffect(() => {
    if (!user) return
    loadCrew()
    loadPendingInvites()
  }, [user])

  const createCrew = async (name) => {
    const { data, error } = await supabase
      .from('crews')
      .insert({ name, pilot_id: user.id })
      .select()
      .single()

    if (error) throw error

    await supabase.from('crew_members').insert({
      crew_id: data.id,
      user_id: user.id,
      role: 'pilot',
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    })

    await loadCrew()
    return data
  }

  const inviteMember = async (email, role = 'copilot') => {
    // OBSERVERS — no VELA account required
    if (role === 'observer') {
      const { error } = await supabase
        .from('crew_members')
        .insert({
          crew_id: crew.id,
          user_id: null,
          guest_email: email,
          role: 'observer',
          status: 'pending',
          invited_by: user.id,
        })

      if (error) {
        console.error('Observer invite error:', error)
        throw new Error('Failed to send observer invite')
      }

      try {
        const { data: pilotProfile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .single()

        await supabase.functions.invoke('send-crew-invite', {
          body: JSON.stringify({
            inviteeEmail: email,
            inviteeName: email,
            pilotName: pilotProfile?.name ?? 'Your pilot',
            crewName: crew.name,
            role: 'observer',
            inviteId: null,
            isGuest: true,
            crewPassword: crew.watch_password ?? 'Contact pilot for password',
          }),
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (emailErr) {
        console.warn('Observer email failed:', emailErr.message)
      }

      await loadCrew()
      return { name: email, email }
    }

    // COPILOTS — must be existing VELA users
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('email', email)
      .maybeSingle()

    if (!profile) {
      throw new Error(
        `${email} is not a VELA user. Copilots must have a VELA account. Observers can watch without signing up.`
      )
    }

    const copilots = members.filter(m => m.role === 'copilot' && m.status === 'accepted')
    const { data: pilotProfile } = await supabase
      .from('profiles')
      .select('plan, name')
      .eq('id', user.id)
      .single()

    if (copilots.length >= 1 && pilotProfile?.plan !== 'pro') {
      throw new Error('Free plan includes 1 copilot. Upgrade to PRO for more copilots. Observers are always free.')
    }

    const { data: newMember, error } = await supabase
      .from('crew_members')
      .insert({
        crew_id: crew.id,
        user_id: profile.id,
        role: 'copilot',
        status: 'pending',
        invited_by: user.id,
        invited_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') throw new Error(`${email} is already in your crew`)
      throw error
    }

    try {
      await supabase.functions.invoke('send-crew-invite', {
        body: JSON.stringify({
          inviteeEmail: email,
          inviteeName: profile.name ?? email,
          pilotName: pilotProfile?.name ?? 'Your pilot',
          crewName: crew.name,
          role: 'copilot',
          inviteId: newMember.id,
          isGuest: false,
        }),
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (emailErr) {
      console.warn('Email send failed:', emailErr.message)
    }

    await loadCrew()
    return profile
  }

  const removeMember = async (memberId) => {
    const { error } = await supabase
      .from('crew_members')
      .delete()
      .eq('id', memberId)
      .neq('role', 'pilot')

    if (error) throw error
    await loadCrew()
  }

  const acceptInvite = async (inviteId) => {
    const { error } = await supabase
      .from('crew_members')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', inviteId)
      .eq('user_id', user.id)

    if (error) throw error
    await loadCrew()
    await loadPendingInvites()
  }

  const declineInvite = async (inviteId) => {
    const { error } = await supabase
      .from('crew_members')
      .update({ status: 'declined' })
      .eq('id', inviteId)
      .eq('user_id', user.id)

    if (error) throw error
    await loadPendingInvites()
  }

  const isPilot = crew?.pilot_id === user?.id

  return {
    crew,
    members,
    pendingInvites,
    loading,
    isPilot,
    createCrew,
    inviteMember,
    removeMember,
    acceptInvite,
    declineInvite,
    reload: loadCrew,
  }
}
