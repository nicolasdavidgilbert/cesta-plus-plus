'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/contexts/UserContext'
import { insforge } from '@/lib/insforge'

type ShoppingList = {
  id: string
  name: string
  owner_id: string
}

type ShoppingListShare = {
  id: string
  list_id: string
  user_id: string
}

type DashboardList = ShoppingList & {
  access: 'owner' | 'shared'
  role?: string
}

type RealtimePayload = {
  meta?: {
    channel?: string
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, signOut, loading: authLoading } = useUser()
  const [lists, setLists] = useState<DashboardList[]>([])
  const [loading, setLoading] = useState(true)
  const [newListName, setNewListName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const loadLists = useCallback(async () => {
    if (!user) return

    const { data: ownLists, error: ownError } = await insforge.database
      .from('shopping_lists')
      .select('*')
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false })

    if (ownError) {
      setError(ownError.message)
      setLists([])
      setLoading(false)
      return
    }

    const { data: shares, error: sharesError } = await insforge.database
      .from('list_shares')
      .select('*')
      .eq('user_id', user.id)

    if (sharesError) {
      setError(sharesError.message)
      setLists((ownLists || []).map((list) => ({ ...list, access: 'owner' as const })))
      setLoading(false)
      return
    }

    const ownListIds = new Set((ownLists || []).map((list) => list.id))
    const sharedShares = (shares as ShoppingListShare[]).filter(
      (share) => !ownListIds.has(share.list_id)
    )

    let sharedLists: ShoppingList[] = []
    if (sharedShares.length > 0) {
      const sharedIds = Array.from(new Set(sharedShares.map((share) => share.list_id)))
      const { data, error: sharedError } = await insforge.database
        .from('shopping_lists')
        .select('*')
        .in('id', sharedIds)
        .order('updated_at', { ascending: false })

      if (sharedError) {
        setError(sharedError.message)
      } else {
        sharedLists = data || []
      }
    }

    const mergedLists: DashboardList[] = [
      ...(ownLists || []).map((list) => ({ ...list, access: 'owner' as const })),
      ...sharedLists.map((list) => ({
        ...list,
        access: 'shared' as const,
        role: 'editor',
      })),
    ]

    mergedLists.sort((a, b) => {
      if (a.access !== b.access) return a.access === 'owner' ? -1 : 1
      return a.name.localeCompare(b.name, 'es')
    })

    setLists(mergedLists)
    setError('')
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (!user) return

    const channel = `user:${user.id}:lists`
    const realtimeHandler = (payload: RealtimePayload) => {
      if (payload.meta?.channel === channel) {
        void loadLists()
      }
    }

    void insforge.realtime.subscribe(channel)
    insforge.realtime.on('user_lists_changed', realtimeHandler)

    return () => {
      insforge.realtime.off('user_lists_changed', realtimeHandler)
      insforge.realtime.unsubscribe(channel)
    }
  }, [user, loadLists])

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/sign-in')
    }
  }, [authLoading, user, router])

  useEffect(() => {
    if (user) {
      queueMicrotask(() => {
        void loadLists()
      })
    }
  }, [user, loadLists])

  async function createList(e: React.FormEvent) {
    e.preventDefault()
    if (!newListName.trim()) return

    setCreating(true)
    setError('')
    const { data, error } = await insforge.database
      .from('shopping_lists')
      .insert([{ name: newListName.trim(), owner_id: user!.id }])
      .select()
      .single()

    if (error) {
      setError(error.message)
    } else if (data) {
      setLists([{ ...data, access: 'owner' }, ...lists])
      setNewListName('')
      await insforge.realtime.publish(`user:${user!.id}:lists`, 'user_lists_changed', {
        list_id: data.id,
        action: 'created',
      })
    }
    setCreating(false)
  }

  async function handleSignOut() {
    await signOut()
    router.push('/sign-in')
  }

  if (authLoading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-xl">
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-orange-500" />
            <div>
              <p className="text-sm font-medium text-slate-900">Cargando dashboard</p>
              <p className="text-xs text-slate-500">Preparando tus listas.</p>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-xl sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-orange-500">Panel</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Mis listas
              </h1>
              <p className="mt-2 text-sm text-slate-500">{user.name || user.email}</p>
              <p className="mt-1 break-all text-xs text-slate-400">ID usuario: {user.id}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto"
            >
              Cerrar sesión
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Listas</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{lists.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Propias</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {lists.filter((list) => list.access === 'owner').length}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Compartidas</p>
              <p className="mt-2 text-sm font-semibold text-emerald-600">
                {lists.filter((list) => list.access === 'shared').length}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Productos</p>
              <Link href="/products" className="mt-2 inline-flex text-sm font-semibold text-orange-600 hover:text-orange-700">
                Ir a productos
              </Link>
            </div>
          </div>

          <nav className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Mis listas
            </Link>
            <Link
              href="/products"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Productos
            </Link>
          </nav>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-xl sm:p-6">
          <form onSubmit={createList} className="space-y-3 sm:flex sm:items-center sm:gap-3 sm:space-y-0">
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="Nombre de la lista"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
            />
            <button
              type="submit"
              disabled={creating || !newListName.trim()}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {creating ? 'Creando...' : 'Crear lista'}
            </button>
          </form>
        </section>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {loading ? (
          <section className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((skeleton) => (
              <div
                key={skeleton}
                className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white/70"
              />
            ))}
          </section>
        ) : lists.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center">
            <h2 className="text-xl font-semibold text-slate-900">No tienes listas todavía</h2>
            <p className="mt-2 text-sm text-slate-500">Crea tu primera lista para empezar a organizar compras.</p>
          </section>
        ) : (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lists.map((list) => (
              <Link
                key={list.id}
                href={`/dashboard/${list.id}`}
                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Lista</p>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">{list.name}</h3>
                  </div>
                  {list.access === 'owner' ? (
                    <span className="rounded-xl bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-700">
                      Propia
                    </span>
                  ) : (
                    <span className="rounded-xl bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                      Compartida
                    </span>
                  )}
                </div>
                <p className="mt-4 text-sm text-slate-500 group-hover:text-slate-700">
                  {list.access === 'owner'
                    ? 'Gestiona productos y marca tus compras en tiempo real.'
                    : `Lista compartida contigo (${list.role || 'editor'}).`}
                </p>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}
