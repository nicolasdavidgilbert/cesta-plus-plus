'use client'

import { memo, useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/contexts/UserContext'
import { insforge } from '@/lib/insforge'
import MobileDashboardNav from '@/app/dashboard/_components/MobileDashboardNav'

type ShoppingList = {
  id: string
  name: string
  owner_id: string
}

type ShoppingListShare = {
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

type ListsCacheEntry = {
  savedAt: number
  lists: DashboardList[]
}

const LISTS_CACHE_TTL_MS = 5 * 60 * 1000
const LISTS_MIN_REFETCH_GAP_MS = 8 * 1000
const LISTS_CACHE_PREFIX = 'dashboard_lists_cache_v1:'

function getListsCacheKey(userId: string) {
  return `${LISTS_CACHE_PREFIX}${userId}`
}

function readCachedLists(userId: string): DashboardList[] | null {
  try {
    const raw = localStorage.getItem(getListsCacheKey(userId))
    if (!raw) return null

    const parsed = JSON.parse(raw) as ListsCacheEntry
    if (!parsed?.savedAt || !Array.isArray(parsed?.lists)) return null
    if (Date.now() - parsed.savedAt > LISTS_CACHE_TTL_MS) return null

    return parsed.lists
  } catch {
    return null
  }
}

function writeCachedLists(userId: string, lists: DashboardList[]) {
  try {
    const payload: ListsCacheEntry = { savedAt: Date.now(), lists }
    localStorage.setItem(getListsCacheKey(userId), JSON.stringify(payload))
  } catch {
    // Ignore storage write failures (private mode, quota, etc.)
  }
}

function reconcileLists(previous: DashboardList[], incoming: DashboardList[]) {
  const previousById = new Map(previous.map((item) => [item.id, item]))
  const reconciled = incoming.map((nextItem) => {
    const prevItem = previousById.get(nextItem.id)
    if (
      prevItem &&
      prevItem.name === nextItem.name &&
      prevItem.owner_id === nextItem.owner_id &&
      prevItem.access === nextItem.access &&
      prevItem.role === nextItem.role
    ) {
      return prevItem
    }

    return nextItem
  })

  const unchanged =
    reconciled.length === previous.length &&
    reconciled.every((item, index) => item === previous[index])

  return unchanged ? previous : reconciled
}

const DashboardListCard = memo(function DashboardListCard({ list }: { list: DashboardList }) {
  return (
    <Link
      href={`/dashboard/${list.id}`}
      className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Lista</p>
          <h3 className="mt-1.5 text-base font-semibold text-slate-900">{list.name}</h3>
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
      <p className="mt-3 text-sm text-slate-500 group-hover:text-slate-700">
        {list.access === 'owner'
          ? 'Gestiona productos y marca compras en tiempo real.'
          : `Lista compartida contigo (${list.role || 'editor'}).`}
      </p>
    </Link>
  )
})

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useUser()
  const [lists, setLists] = useState<DashboardList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [newListName, setNewListName] = useState('')
  const [creating, setCreating] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const lastFetchAtRef = useRef(0)
  const hydratedFromCacheRef = useRef(false)

  const applyLists = useCallback(
    (nextLists: DashboardList[]) => {
      if (!user) return

      setLists((previous) => {
        const reconciled = reconcileLists(previous, nextLists)
        if (reconciled !== previous) {
          writeCachedLists(user.id, reconciled)
        }
        return reconciled
      })
    },
    [user]
  )

  const loadLists = useCallback(async (options?: { force?: boolean; keepCurrentUI?: boolean }) => {
    if (!user) return
    const force = options?.force ?? false
    const keepCurrentUI = options?.keepCurrentUI ?? false
    const now = Date.now()
    if (!force && now - lastFetchAtRef.current < LISTS_MIN_REFETCH_GAP_MS) {
      return
    }
    lastFetchAtRef.current = now

    if (!keepCurrentUI) {
      setLoading(true)
    }

    const { data: ownLists, error: ownError } = await insforge.database
      .from('shopping_lists')
      .select('*')
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false })

    if (ownError) {
      setError(ownError.message)
      applyLists([])
      setLoading(false)
      return
    }

    const { data: shares, error: sharesError } = await insforge.database
      .from('list_shares')
      .select('*')
      .eq('user_id', user.id)

    if (sharesError) {
      setError(sharesError.message)
      applyLists((ownLists || []).map((list) => ({ ...list, access: 'owner' as const })))
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
      ...sharedLists.map((list) => ({ ...list, access: 'shared' as const, role: 'editor' })),
    ]

    mergedLists.sort((a, b) => a.name.localeCompare(b.name, 'es'))

    applyLists(mergedLists)
    setError('')
    setLoading(false)
  }, [user, applyLists])

  useEffect(() => {
    if (!user) return

    const channel = `user:${user.id}:lists`
    const realtimeHandler = (payload: RealtimePayload) => {
      if (payload.meta?.channel === channel) {
        void loadLists({ keepCurrentUI: true })
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
      const cachedLists = readCachedLists(user.id)
      if (cachedLists) {
        hydratedFromCacheRef.current = true
        queueMicrotask(() => {
          applyLists(cachedLists)
        })
      } else {
        hydratedFromCacheRef.current = false
      }

      queueMicrotask(() => {
        void loadLists({ force: true, keepCurrentUI: hydratedFromCacheRef.current })
      })
    }
  }, [user, loadLists, applyLists])

  async function createList(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !newListName.trim()) return

    setCreating(true)
    setError('')

    const { data, error: createError } = await insforge.database
      .from('shopping_lists')
      .insert([{ name: newListName.trim(), owner_id: user.id }])
      .select()
      .single()

    if (createError) {
      setError(createError.message)
      setCreating(false)
      return
    }

    setNewListName('')
    setCreating(false)
    setShowCreateModal(false)
    if (data?.id) {
      await insforge.realtime.publish(`user:${user.id}:lists`, 'user_lists_changed', {
        list_id: data.id,
        action: 'created',
      })
      router.push(`/dashboard/${data.id}`)
    } else {
      void loadLists({ force: true })
    }
  }

  const normalizedSearch = search.trim().toLowerCase()
  const filteredLists = normalizedSearch
    ? lists.filter((list) => list.name.toLowerCase().includes(normalizedSearch))
    : lists

  if (authLoading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-xl">
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-orange-500" />
            <div>
              <p className="text-sm font-medium text-slate-900">Cargando listas</p>
              <p className="text-xs text-slate-500">Preparando tu contenido.</p>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <>
      <main className="min-h-screen px-4 py-6 pb-36 sm:px-6">
        <div className="mx-auto w-full max-w-3xl space-y-4">
          <header className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-500">Listas</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Mis listas</h1>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar lista..."
              className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
            />
          </header>

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {loading && lists.length === 0 ? (
            <section className="grid gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((skeleton) => (
                <div
                  key={skeleton}
                  className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white/70"
                />
              ))}
            </section>
          ) : filteredLists.length === 0 ? (
            <section className="rounded-3xl border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center">
              <h2 className="text-xl font-semibold text-slate-900">
                {lists.length === 0 ? 'No tienes listas todavía' : 'Sin resultados'}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {lists.length === 0
                  ? 'Crea tu primera lista desde otra pantalla o funcionalidad.'
                  : 'Prueba con otro texto en el buscador.'}
              </p>
            </section>
          ) : (
            <section className="grid gap-3 sm:grid-cols-2">
              {filteredLists.map((list) => (
                <DashboardListCard key={list.id} list={list} />
              ))}
            </section>
          )}
        </div>
      </main>

      <button
        type="button"
        onClick={() => setShowCreateModal(true)}
        aria-label="Crear nueva lista"
        className="fixed bottom-24 right-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-3xl font-semibold leading-none text-white shadow-lg transition hover:bg-orange-600 sm:bottom-24 sm:right-6"
      >
        +
      </button>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-900/50 p-4 sm:items-center sm:justify-center sm:p-6">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Nueva lista</h2>
              <button
                type="button"
                onClick={() => {
                  if (!creating) {
                    setShowCreateModal(false)
                  }
                }}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>
            <form onSubmit={createList} className="mt-4 space-y-3">
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="Nombre de la lista..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                autoFocus
              />
              <button
                type="submit"
                disabled={creating || !newListName.trim()}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ? 'Creando...' : 'Crear lista'}
              </button>
            </form>
          </div>
        </div>
      )}

      <MobileDashboardNav />
    </>
  )
}
