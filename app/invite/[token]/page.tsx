'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { insforge } from '@/lib/insforge'

type AcceptedInvite = {
  list_id: string
  list_name: string
  owner_id: string
  already_member: boolean
}

export default function InvitePage() {
  const router = useRouter()
  const params = useParams()
  const token = params.token as string
  const { user, loading: authLoading } = useUser()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [joinedList, setJoinedList] = useState<AcceptedInvite | null>(null)

  useEffect(() => {
    if (!token) return
    if (authLoading) return

    if (!user) {
      router.replace(`/sign-in?redirect=${encodeURIComponent(`/invite/${token}`)}`)
      return
    }

    let cancelled = false

    const acceptInvite = async () => {
      setLoading(true)
      setError('')
      const { data, error } = await insforge.database.rpc('accept_list_invite', {
        invite_token: token,
      })

      if (cancelled) return

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      const accepted = (Array.isArray(data) ? data[0] : data) as AcceptedInvite | undefined
      if (!accepted) {
        setError('No se pudo validar el enlace.')
        setLoading(false)
        return
      }

      setJoinedList(accepted)

      await Promise.all([
        insforge.realtime.publish(`list:${accepted.list_id}`, 'members_changed', {
          action: 'joined_by_link',
          target_user_id: user.id,
          timestamp: new Date().toISOString(),
        }),
        insforge.realtime.publish(`user:${user.id}:lists`, 'user_lists_changed', {
          list_id: accepted.list_id,
          action: 'shared',
          by: user.id,
          timestamp: new Date().toISOString(),
        }),
        insforge.realtime.publish(`user:${accepted.owner_id}:lists`, 'user_lists_changed', {
          list_id: accepted.list_id,
          action: 'shared',
          by: user.id,
          timestamp: new Date().toISOString(),
        }),
      ])

      router.replace(`/dashboard/${accepted.list_id}`)
    }

    queueMicrotask(() => {
      void acceptInvite()
    })

    return () => {
      cancelled = true
    }
  }, [authLoading, router, token, user])

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl sm:p-8">
        {loading ? (
          <>
            <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-orange-500" />
              <div>
                <p className="text-sm font-medium text-slate-900">Uniéndote a la lista</p>
                <p className="text-xs text-slate-500">Estamos validando tu invitación.</p>
              </div>
            </div>
            {joinedList && (
              <p className="mt-4 text-sm text-slate-600">
                Acceso concedido a <span className="font-semibold text-slate-900">{joinedList.list_name}</span>.
              </p>
            )}
          </>
        ) : error ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => router.refresh()}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Reintentar
              </button>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Ir al dashboard
              </Link>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  )
}
