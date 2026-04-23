'use client'

import { useEffect, useRef } from 'react'
import { insforge } from '@/lib/insforge'

export type RealtimePayload = {
  meta?: {
    channel?: string
    senderId?: string
  }
}

export type RealtimeProduct = {
  id: string
  title: string
  current_price: number | null
}

export type RealtimeListItem = {
  id: string
  list_id: string
  product_id: string
  quantity: number
  checked: boolean
  product?: RealtimeProduct
}

export type ListChangedRealtimePayload = RealtimePayload & {
  action?: string
  checked?: boolean
  item?: RealtimeListItem
  item_id?: string
  product?: RealtimeProduct
  product_id?: string
  quantity?: number
  user_id?: string
}

type ListRealtimeProps = {
  canManageMembers: boolean
  listId: string
  onInviteLinksChanged: () => void
  onListChanged: (payload: ListChangedRealtimePayload) => void
  onMembersChanged: () => void
  userId: string
}

export function ListRealtime({
  canManageMembers,
  listId,
  onInviteLinksChanged,
  onListChanged,
  onMembersChanged,
  userId,
}: ListRealtimeProps) {
  const canManageMembersRef = useRef(canManageMembers)
  const onInviteLinksChangedRef = useRef(onInviteLinksChanged)
  const onListChangedRef = useRef(onListChanged)
  const onMembersChangedRef = useRef(onMembersChanged)

  useEffect(() => {
    canManageMembersRef.current = canManageMembers
    onInviteLinksChangedRef.current = onInviteLinksChanged
    onListChangedRef.current = onListChanged
    onMembersChangedRef.current = onMembersChanged
  }, [canManageMembers, onInviteLinksChanged, onListChanged, onMembersChanged])

  useEffect(() => {
    if (!listId || !userId) return

    let cancelled = false
    const channel = `list:${listId}`

    // The server prefixes meta.channel with "realtime:" — normalise before comparing
    const isForCurrentChannel = (payload: RealtimePayload) => {
      if (!payload.meta?.channel) return true
      const metaChannel = payload.meta.channel.replace(/^realtime:/, '')
      return metaChannel === channel
    }

    const listUpdatesHandler = (payload: ListChangedRealtimePayload) => {
      if (!isForCurrentChannel(payload)) return

      const isOwnEvent = payload.meta?.senderId === userId || payload.user_id === userId
      if (!isOwnEvent) {
        onListChangedRef.current(payload)
      }
    }

    const membersUpdatesHandler = (payload: RealtimePayload) => {
      if (!isForCurrentChannel(payload)) return
      onMembersChangedRef.current()
    }

    const inviteLinksUpdatesHandler = (payload: RealtimePayload) => {
      if (!isForCurrentChannel(payload) || !canManageMembersRef.current) return
      onInviteLinksChangedRef.current()
    }

    async function doSubscribe() {
      if (cancelled) return

      if (!insforge.realtime.isConnected) {
        await insforge.realtime.connect()
      }

      if (cancelled) return

      const result = await insforge.realtime.subscribe(channel)
      if (!result.ok) {
        console.error(`[ListRealtime] Failed to subscribe to ${channel}:`, result.error?.message)
      }
    }

    const handleConnect = () => {
      if (!cancelled) {
        insforge.realtime.subscribe(channel).then((result) => {
          if (!result.ok) {
            console.error(`[ListRealtime] Re-subscribe failed for ${channel}:`, result.error?.message)
          }
        })
      }
    }

    const handleDisconnect = () => {
      console.warn(`[ListRealtime] WebSocket disconnected, will re-subscribe on reconnect`)
    }

    insforge.realtime.on('list_changed', listUpdatesHandler)
    insforge.realtime.on('members_changed', membersUpdatesHandler)
    insforge.realtime.on('invite_links_changed', inviteLinksUpdatesHandler)
    insforge.realtime.on('connect', handleConnect)
    insforge.realtime.on('disconnect', handleDisconnect)

    doSubscribe()

    return () => {
      cancelled = true
      insforge.realtime.off('list_changed', listUpdatesHandler)
      insforge.realtime.off('members_changed', membersUpdatesHandler)
      insforge.realtime.off('invite_links_changed', inviteLinksUpdatesHandler)
      insforge.realtime.off('connect', handleConnect)
      insforge.realtime.off('disconnect', handleDisconnect)
      insforge.realtime.unsubscribe(channel)
    }
  }, [listId, userId])

  return null
}
