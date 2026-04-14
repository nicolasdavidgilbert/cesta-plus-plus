'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/contexts/UserContext'
import { insforge } from '@/lib/insforge'

type ShoppingList = {
  id: string
  name: string
  owner_id: string
}

type Product = {
  id: string
  title: string
  current_price: number | null
}

type ListItem = {
  id: string
  list_id: string
  product_id: string
  quantity: number
  checked: boolean
  product?: Product
}

type ShoppingListShare = {
  id: string
  list_id: string
  user_id: string
}

type InviteLink = {
  id: string
  list_id: string
  token: string
  created_by: string
  created_at: string
  expires_at: string | null
  revoked_at: string | null
  last_used_at: string | null
}

type CreatedListProduct = {
  created_id: string
  title: string
  current_price: number | null
}

type ShareByEmailResult = {
  shared_user_id: string
  shared_email: string
  already_shared: boolean
}

type RealtimePayload = {
  meta?: {
    channel?: string
    senderId?: string
  }
}

const inputClassName =
  'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100'

export default function ListDetailPage() {
  const router = useRouter()
  const params = useParams()
  const listId = params.id as string
  const { user, loading: authLoading } = useUser()
  const [list, setList] = useState<ShoppingList | null>(null)
  const [items, setItems] = useState<ListItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [members, setMembers] = useState<ShoppingListShare[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [newProduct, setNewProduct] = useState({ title: '', description: '', price: '' })
  const [creatingProduct, setCreatingProduct] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'products' | 'settings'>('products')
  const [listNameDraft, setListNameDraft] = useState('')
  const [savingListName, setSavingListName] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [sharingEmail, setSharingEmail] = useState(false)
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([])
  const [loadingInviteLinks, setLoadingInviteLinks] = useState(false)
  const [generatingInviteLink, setGeneratingInviteLink] = useState(false)
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null)
  const [copiedLinkToken, setCopiedLinkToken] = useState<string | null>(null)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)

  const listChannel = `list:${listId}`
  const canManageMembers = list?.owner_id === user?.id

  const loadMembers = useCallback(async () => {
    const { data, error } = await insforge.database
      .from('list_shares')
      .select('*')
      .eq('list_id', listId)

    if (error) {
      setError(error.message)
      return
    }

    setMembers((data as ShoppingListShare[]) || [])
  }, [listId])

  const loadInviteLinks = useCallback(async () => {
    if (!canManageMembers) {
      setInviteLinks([])
      return
    }

    setLoadingInviteLinks(true)
    const { data, error } = await insforge.database
      .from('list_invite_links')
      .select('*')
      .eq('list_id', listId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(6)

    if (error) {
      setError(error.message)
      setLoadingInviteLinks(false)
      return
    }

    setInviteLinks((data as InviteLink[]) || [])
    setLoadingInviteLinks(false)
  }, [canManageMembers, listId])

  const loadData = useCallback(async () => {
    if (!user) return
    setError('')

    const [listRes, itemsRes, ownProductsRes] = await Promise.all([
      insforge.database.from('shopping_lists').select('*').eq('id', listId).single(),
      insforge.database.from('shopping_list_items').select('*').eq('list_id', listId),
      insforge.database
        .from('products')
        .select('id, title, current_price')
        .eq('created_by', user.id)
        .order('title'),
    ])

    const firstError = listRes.error ?? itemsRes.error ?? ownProductsRes.error
    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    if (!listRes.data) {
      setError('No se encontró la lista.')
      setLoading(false)
      return
    }

    if (listRes.data.owner_id !== user.id) {
      const { data: membership } = await insforge.database
        .from('list_shares')
        .select('*')
        .eq('list_id', listId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!membership) {
        setError('No tienes permisos para ver esta lista.')
        setLoading(false)
        return
      }
    }

    const nextList = listRes.data as ShoppingList
    setList(nextList)
    setListNameDraft(nextList.name)

    let listProducts: Product[] = []
    if ((itemsRes.data || []).length > 0) {
      const { data: listProductsData, error: listProductsError } = await insforge.database.rpc(
        'list_visible_products',
        {
          target_list_id: listId,
        }
      )

      if (listProductsError) {
        setError(listProductsError.message)
        setLoading(false)
        return
      }

      listProducts = (listProductsData as Product[]) || []
    }

    if (itemsRes.data) {
      const itemsWithProducts = itemsRes.data.map((item) => ({
        ...item,
        product: listProducts.find((product) => product.id === item.product_id),
      }))
      setItems(itemsWithProducts as ListItem[])
    } else {
      setItems([])
    }

    setProducts((ownProductsRes.data as Product[]) || [])
    setLoading(false)
  }, [listId, user])

  const publishListEvent = useCallback(
    async (eventName: string, payload: Record<string, unknown>) => {
      if (!user) return
      await insforge.realtime.publish(listChannel, eventName, {
        ...payload,
        list_id: listId,
        user_id: user.id,
        timestamp: new Date().toISOString(),
      })
    },
    [listChannel, listId, user]
  )

  const publishUserListsEvent = useCallback(
    async (targetUserId: string, action: string) => {
      if (!targetUserId) return
      await insforge.realtime.publish(`user:${targetUserId}:lists`, 'user_lists_changed', {
        list_id: listId,
        action,
        by: user?.id,
        timestamp: new Date().toISOString(),
      })
    },
    [listId, user?.id]
  )

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/sign-in')
    }
  }, [authLoading, user, router])

  useEffect(() => {
    if (user && listId) {
      queueMicrotask(() => {
        void loadData()
      })
    }
  }, [user, listId, loadData])

  useEffect(() => {
    if (!canManageMembers) return

    queueMicrotask(() => {
      void loadMembers()
      void loadInviteLinks()
    })
  }, [canManageMembers, loadInviteLinks, loadMembers])

  useEffect(() => {
    if (!user || !listId) return

    const listUpdatesHandler = (payload: RealtimePayload) => {
      if (payload.meta?.channel === listChannel && payload.meta?.senderId !== user.id) {
        void loadData()
      }
    }

    const membersUpdatesHandler = (payload: RealtimePayload) => {
      if (payload.meta?.channel === listChannel) {
        void loadMembers()
        void loadData()
      }
    }

    const inviteLinksUpdatesHandler = (payload: RealtimePayload) => {
      if (payload.meta?.channel === listChannel && canManageMembers) {
        void loadInviteLinks()
      }
    }

    void insforge.realtime.subscribe(listChannel)
    insforge.realtime.on('list_changed', listUpdatesHandler)
    insforge.realtime.on('members_changed', membersUpdatesHandler)
    insforge.realtime.on('invite_links_changed', inviteLinksUpdatesHandler)

    return () => {
      insforge.realtime.off('list_changed', listUpdatesHandler)
      insforge.realtime.off('members_changed', membersUpdatesHandler)
      insforge.realtime.off('invite_links_changed', inviteLinksUpdatesHandler)
      insforge.realtime.unsubscribe(listChannel)
    }
  }, [canManageMembers, listChannel, listId, loadData, loadInviteLinks, loadMembers, user])

  function buildInviteUrl(token: string) {
    if (typeof window === 'undefined') return `/invite/${token}`
    return `${window.location.origin}/invite/${token}`
  }

  async function addMemberByEmail() {
    if (!canManageMembers || !user) return
    const targetEmail = shareEmail.trim().toLowerCase()
    if (!targetEmail) return
    if (targetEmail === user.email.toLowerCase()) {
      setError('No necesitas compartir la lista contigo mismo.')
      return
    }

    setSharingEmail(true)
    setError('')

    const { data, error } = await insforge.database.rpc('share_list_with_email', {
      target_list_id: listId,
      target_email: targetEmail,
    })

    if (error) {
      setError(error.message)
      setSharingEmail(false)
      return
    }

    const shareResult = (Array.isArray(data) ? data[0] : data) as ShareByEmailResult | undefined
    if (!shareResult) {
      setError('No se pudo compartir la lista con ese email.')
      setSharingEmail(false)
      return
    }

    if (shareResult.already_shared) {
      setError('Ese usuario ya tiene acceso a la lista.')
      setSharingEmail(false)
      return
    }

    setShareEmail('')
    await loadMembers()
    await publishListEvent('members_changed', {
      action: 'added_by_email',
      target_user_id: shareResult.shared_user_id,
      target_email: shareResult.shared_email,
    })
    await publishUserListsEvent(shareResult.shared_user_id, 'shared')
    await publishUserListsEvent(user.id, 'shared')
    setSharingEmail(false)
  }

  async function createInviteLink() {
    if (!canManageMembers || !user) return

    setGeneratingInviteLink(true)
    setError('')
    const { data, error } = await insforge.database
      .from('list_invite_links')
      .insert([
        {
          list_id: listId,
          created_by: user.id,
        },
      ])
      .select('*')
      .single()

    if (error) {
      setError(error.message)
      setGeneratingInviteLink(false)
      return
    }

    if (data) {
      await loadInviteLinks()
      await publishListEvent('invite_links_changed', { action: 'created', invite_id: data.id })
      await publishUserListsEvent(user.id, 'updated')
    }
    setGeneratingInviteLink(false)
  }

  async function revokeInviteLink(invite: InviteLink) {
    if (!canManageMembers || !user) return

    setRevokingInviteId(invite.id)
    setError('')
    const { error } = await insforge.database
      .from('list_invite_links')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', invite.id)

    if (error) {
      setError(error.message)
      setRevokingInviteId(null)
      return
    }

    await loadInviteLinks()
    await publishListEvent('invite_links_changed', { action: 'revoked', invite_id: invite.id })
    setRevokingInviteId(null)
  }

  async function copyInviteLink(token: string) {
    const inviteUrl = buildInviteUrl(token)
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopiedLinkToken(token)
      window.setTimeout(() => {
        setCopiedLinkToken((current) => (current === token ? null : current))
      }, 1600)
    } catch {
      setError('No se pudo copiar el enlace.')
    }
  }

  function openGmailForInvite(token: string) {
    const inviteUrl = buildInviteUrl(token)
    const to = shareEmail.trim()
    const subject = encodeURIComponent(`Únete a mi lista "${list?.name || 'Lista de compra'}"`)
    const body = encodeURIComponent(
      `Te comparto mi lista para que podamos editarla juntos.\n\nÚnete aquí: ${inviteUrl}`
    )
    const target = to ? `&to=${encodeURIComponent(to)}` : ''
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1${target}&su=${subject}&body=${body}`
    window.open(gmailUrl, '_blank', 'noopener,noreferrer')
  }

  async function updateListName() {
    if (!canManageMembers || !list) return
    const nextName = listNameDraft.trim()
    if (!nextName) return
    if (nextName === list.name) return

    setSavingListName(true)
    setError('')
    const { data, error } = await insforge.database
      .from('shopping_lists')
      .update({
        name: nextName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', list.id)
      .select()
      .single()

    if (error) {
      setError(error.message)
      setSavingListName(false)
      return
    }

    if (data) {
      const updatedList = data as ShoppingList
      setList(updatedList)
      setListNameDraft(updatedList.name)
      await publishListEvent('list_changed', { action: 'list_renamed', list_name: nextName })
      await publishUserListsEvent(user!.id, 'updated')
      await Promise.all(members.map((member) => publishUserListsEvent(member.user_id, 'updated')))
    }

    setSavingListName(false)
  }

  async function removeMember(member: ShoppingListShare) {
    if (!canManageMembers) return

    setRemovingMemberId(member.id)
    setError('')
    const { error } = await insforge.database.from('list_shares').delete().eq('id', member.id)

    if (error) {
      setError(error.message)
      setRemovingMemberId(null)
      return
    }

    await loadMembers()
    await publishListEvent('members_changed', { action: 'removed', target_user_id: member.user_id })
    await publishUserListsEvent(member.user_id, 'unshared')
    await publishUserListsEvent(user!.id, 'shared')
    setRemovingMemberId(null)
  }

  async function addExistingProduct(productId: string) {
    setError('')
    const existingItem = items.find((item) => item.product_id === productId)
    const { error } = existingItem
      ? await insforge.database
          .from('shopping_list_items')
          .update({ quantity: existingItem.quantity + 1 })
          .eq('id', existingItem.id)
      : await insforge.database.from('shopping_list_items').insert([
          {
            list_id: listId,
            product_id: productId,
            quantity: 1,
          },
        ])

    if (error) {
      setError(error.message)
      return
    }

    await publishListEvent('list_changed', { action: 'item_added', product_id: productId })
    await loadData()
    setShowAddProduct(false)
  }

  async function createAndAddProduct(e: React.FormEvent) {
    e.preventDefault()
    if (!newProduct.title.trim()) return

    setCreatingProduct(true)
    setError('')
    const parsedPrice = newProduct.price.trim() ? Number(newProduct.price.replace(',', '.')) : null
    const price = parsedPrice !== null && Number.isFinite(parsedPrice) ? parsedPrice : null

    const { data, error } = await insforge.database.rpc('create_product_for_list', {
      target_list_id: listId,
      product_title: newProduct.title.trim(),
      product_description: newProduct.description.trim() || null,
      product_price: price,
    })

    if (error) {
      setError(error.message)
      setCreatingProduct(false)
      return
    }

    const created = (Array.isArray(data) ? data[0] : data) as CreatedListProduct | undefined
    if (created) {
      await publishListEvent('list_changed', { action: 'product_created', product_id: created.created_id })
      await publishUserListsEvent(user!.id, 'updated')
      const memberIds = members.map((member) => member.user_id)
      await Promise.all(memberIds.map((memberId) => publishUserListsEvent(memberId, 'updated')))

      await loadData()
      setNewProduct({ title: '', description: '', price: '' })
    }
    setCreatingProduct(false)
    setShowAddProduct(false)
  }

  async function toggleChecked(item: ListItem) {
    setError('')
    const { error } = await insforge.database
      .from('shopping_list_items')
      .update({ checked: !item.checked })
      .eq('id', item.id)

    if (error) {
      setError(error.message)
      return
    }

    await publishListEvent('list_changed', { action: 'item_checked', item_id: item.id })
    await loadData()
  }

  async function updateQuantity(item: ListItem, delta: number) {
    setError('')
    const newQuantity = item.quantity + delta
    const { error } =
      newQuantity < 1
        ? await insforge.database.from('shopping_list_items').delete().eq('id', item.id)
        : await insforge.database
            .from('shopping_list_items')
            .update({ quantity: newQuantity })
            .eq('id', item.id)

    if (error) {
      setError(error.message)
      return
    }

    await publishListEvent('list_changed', { action: 'item_quantity', item_id: item.id })
    await loadData()
  }

  async function removeItem(itemId: string) {
    setError('')
    const { error } = await insforge.database.from('shopping_list_items').delete().eq('id', itemId)
    if (error) {
      setError(error.message)
      return
    }
    await publishListEvent('list_changed', { action: 'item_removed', item_id: itemId })
    await loadData()
  }

  async function deleteList() {
    if (!confirm('¿Eliminar esta lista?')) return
    setError('')

    const memberIds = members.map((member) => member.user_id)
    const { error } = await insforge.database.from('shopping_lists').delete().eq('id', listId)
    if (error) {
      setError(error.message)
      return
    }

    await Promise.all(memberIds.map((memberId) => publishUserListsEvent(memberId, 'deleted')))
    await publishUserListsEvent(user!.id, 'deleted')
    router.push('/dashboard')
  }

  const uncheckedItems = items.filter((item) => !item.checked)
  const checkedItems = items.filter((item) => item.checked)
  const checkedTotal = checkedItems.reduce(
    (sum, item) => sum + (item.product?.current_price || 0) * item.quantity,
    0
  )
  const total = items.reduce((sum, item) => sum + (item.product?.current_price || 0) * item.quantity, 0)
  const progress = total > 0 ? (checkedTotal / total) * 100 : 0

  if (authLoading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-xl">
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-orange-500" />
            <div>
              <p className="text-sm font-medium text-slate-900">Cargando lista</p>
              <p className="text-xs text-slate-500">Preparando tus productos.</p>
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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Link
                href="/dashboard"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-500 transition hover:bg-slate-50"
              >
                Volver
              </Link>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                {list?.name || 'Lista'}
              </h1>
              <p className="mt-2 text-sm text-slate-500">Marca tareas, ajusta cantidad y controla el total.</p>
            </div>
            <button
              onClick={() => setActiveTab((prev) => (prev === 'products' ? 'settings' : 'products'))}
              className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {activeTab === 'products' ? 'Ajustes' : 'Ver productos'}
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Pendientes</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{uncheckedItems.length}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Completados</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{checkedItems.length}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Llevas</p>
              <p className="mt-2 text-lg font-semibold text-emerald-600">{checkedTotal.toFixed(2)} EUR</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total estimado</p>
              <p className="mt-2 text-lg font-semibold text-emerald-600">{total.toFixed(2)} EUR</p>
            </article>
          </div>

          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-emerald-800">Gasto acumulado</p>
              <p className="text-base font-semibold text-emerald-700">{checkedTotal.toFixed(2)} EUR</p>
            </div>
            <div className="mt-3 h-2 rounded-full bg-emerald-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-emerald-700">
              Llevas {progress.toFixed(0)}% del total estimado de la lista.
            </p>
          </div>

          <div className="mt-5 inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
            <button
              onClick={() => setActiveTab('products')}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                activeTab === 'products'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:bg-white/70'
              }`}
            >
              Productos
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                activeTab === 'settings'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:bg-white/70'
              }`}
            >
              Ajustes
            </button>
          </div>
        </header>

        {activeTab === 'settings' && (
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-xl sm:p-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h2 className="text-lg font-semibold text-slate-900">Ajustes de lista</h2>
              <p className="mt-1 text-sm text-slate-500">
                Aquí puedes editar y compartir la lista. La vista principal queda enfocada en productos.
              </p>

              <div className="mt-4 space-y-2">
                <label className="text-sm font-semibold text-slate-700">Nombre de la lista</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={listNameDraft}
                    onChange={(e) => setListNameDraft(e.target.value)}
                    disabled={!canManageMembers}
                    className={inputClassName}
                    placeholder="Nombre de la lista"
                  />
                  {canManageMembers && (
                    <button
                      onClick={() => void updateListName()}
                      disabled={savingListName || !listNameDraft.trim()}
                      className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingListName ? 'Guardando...' : 'Guardar nombre'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-base font-semibold text-slate-900">Compartir lista</h3>
              <p className="mt-1 text-sm text-slate-500">
                Comparte por email y/o crea un enlace para que otras personas puedan usar esta lista.
              </p>

              {!canManageMembers ? (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  Solo el propietario puede gestionar los accesos compartidos.
                </p>
              ) : (
                <>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <input
                      type="email"
                      value={shareEmail}
                      onChange={(e) => setShareEmail(e.target.value)}
                      placeholder="email@ejemplo.com"
                      className={inputClassName}
                    />
                    <button
                      onClick={() => void addMemberByEmail()}
                      disabled={sharingEmail || !shareEmail.trim()}
                      className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {sharingEmail ? 'Compartiendo...' : 'Compartir por email'}
                    </button>
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                    Consejo: si la persona no está registrada aún, usa un enlace de invitación.
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Enlaces de invitación</p>
                        <p className="text-xs text-slate-500">Genera enlaces para enviar por WhatsApp o Gmail.</p>
                      </div>
                      <button
                        onClick={() => void createInviteLink()}
                        disabled={generatingInviteLink}
                        className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {generatingInviteLink ? 'Generando...' : 'Generar enlace'}
                      </button>
                    </div>

                    <div className="mt-3 space-y-2">
                      {loadingInviteLinks ? (
                        <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">Cargando enlaces...</p>
                      ) : inviteLinks.length === 0 ? (
                        <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">
                          No hay enlaces activos.
                        </p>
                      ) : (
                        inviteLinks.map((invite) => {
                          const inviteUrl = buildInviteUrl(invite.token)
                          return (
                            <div
                              key={invite.id}
                              className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                            >
                              <p className="truncate text-xs text-slate-600">{inviteUrl}</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <button
                                  onClick={() => void copyInviteLink(invite.token)}
                                  className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                                >
                                  {copiedLinkToken === invite.token ? 'Copiado' : 'Copiar'}
                                </button>
                                <button
                                  onClick={() => openGmailForInvite(invite.token)}
                                  className="inline-flex items-center rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 transition hover:bg-orange-100"
                                >
                                  Abrir Gmail
                                </button>
                                <button
                                  onClick={() => void revokeInviteLink(invite)}
                                  disabled={revokingInviteId === invite.id}
                                  className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {revokingInviteId === invite.id ? 'Revocando...' : 'Revocar'}
                                </button>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="rounded-xl bg-slate-50 p-3 text-sm">
                      <p className="font-semibold text-slate-900">Propietario</p>
                      <p className="mt-1 break-all text-xs text-slate-500">{list?.owner_id}</p>
                    </div>
                    {members.length === 0 ? (
                      <p className="px-1 py-2 text-sm text-slate-500">Aún no hay miembros compartidos.</p>
                    ) : (
                      members.map((member) => (
                        <div
                          key={member.id}
                          className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900">editor</p>
                            <p className="mt-1 break-all text-xs text-slate-500">{member.user_id}</p>
                          </div>
                          <button
                            onClick={() => void removeMember(member)}
                            disabled={removingMemberId === member.id}
                            className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {removingMemberId === member.id ? 'Quitando...' : 'Quitar acceso'}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {canManageMembers && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <h3 className="text-base font-semibold text-rose-700">Zona peligrosa</h3>
                <p className="mt-1 text-sm text-rose-600">
                  Eliminar la lista borra todos los elementos asociados para todos los usuarios compartidos.
                </p>
                <button
                  onClick={deleteList}
                  className="mt-3 inline-flex items-center rounded-2xl border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  Eliminar lista
                </button>
              </div>
            )}
          </section>
        )}

        {activeTab === 'products' && (
          <button
            onClick={() => setShowAddProduct(true)}
            className="inline-flex w-full items-center justify-center rounded-3xl border-2 border-dashed border-orange-300 bg-orange-50 px-4 py-5 text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
          >
            + Añadir producto
          </button>
        )}

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {activeTab === 'products' && (loading ? (
          <section className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((skeleton) => (
              <div
                key={skeleton}
                className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white/70"
              />
            ))}
          </section>
        ) : items.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center">
            <h2 className="text-xl font-semibold text-slate-900">Lista vacía</h2>
            <p className="mt-2 text-sm text-slate-500">Añade productos para empezar tu compra.</p>
          </section>
        ) : (
          <section className="space-y-6">
            {uncheckedItems.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Pendientes</h2>
                <div className="space-y-3">
                  {uncheckedItems.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => void toggleChecked(item)}
                          className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 border-slate-300 transition hover:border-emerald-500"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-semibold text-slate-900">{item.product?.title}</p>
                          {item.product?.current_price != null && (
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                              <p className="text-emerald-600">{item.product.current_price.toFixed(2)} EUR por unidad</p>
                              <span className="text-slate-400">•</span>
                              <p className="font-medium text-slate-700">
                                Subtotal: {(item.product.current_price * item.quantity).toFixed(2)} EUR
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-slate-50 p-1">
                          <button
                            onClick={() => void updateQuantity(item, -1)}
                            className="h-9 w-9 rounded-xl text-lg font-semibold text-slate-700 transition hover:bg-white"
                          >
                            -
                          </button>
                          <span className="min-w-10 text-center text-sm font-semibold text-slate-900">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => void updateQuantity(item, 1)}
                            className="h-9 w-9 rounded-xl text-lg font-semibold text-slate-700 transition hover:bg-white"
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => void removeItem(item.id)}
                          className="inline-flex items-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-100"
                        >
                          Quitar
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {checkedItems.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Completados</h2>
                <div className="space-y-2">
                  {checkedItems.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 opacity-80"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => void toggleChecked(item)}
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 border-emerald-500 bg-emerald-500 text-white"
                        >
                          ✓
                        </button>
                        <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-500 line-through">
                          {item.product?.title}
                        </p>
                        {item.product?.current_price != null && (
                          <p className="text-xs font-semibold text-emerald-700">
                            {(item.product.current_price * item.quantity).toFixed(2)} EUR
                          </p>
                        )}
                        <button
                          onClick={() => void removeItem(item.id)}
                          className="inline-flex items-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-100"
                        >
                          Quitar
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
        ))}
      </div>

      {activeTab === 'products' && showAddProduct && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-900/50 p-3 sm:items-center sm:justify-center sm:p-6">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
            <h3 className="text-xl font-semibold text-slate-900">Añadir producto</h3>
            <p className="mt-1 text-sm text-slate-500">Usa uno existente o crea uno nuevo.</p>

            <div className="mt-5 space-y-2">
              <h4 className="text-sm font-semibold text-slate-700">Productos existentes</h4>
              <div className="max-h-44 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
                {products.length === 0 ? (
                  <p className="p-2 text-sm text-slate-500">No hay productos existentes.</p>
                ) : (
                  products.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => void addExistingProduct(product.id)}
                      className="flex w-full items-center justify-between rounded-xl bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-orange-50"
                    >
                      <span>{product.title}</span>
                      {product.current_price !== null && (
                        <span className="text-xs font-semibold text-emerald-600">
                          {product.current_price.toFixed(2)} EUR
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              <h4 className="text-sm font-semibold text-slate-700">Crear nuevo producto</h4>
              <form onSubmit={createAndAddProduct} className="space-y-3">
                <input
                  type="text"
                  value={newProduct.title}
                  onChange={(e) => setNewProduct({ ...newProduct, title: e.target.value })}
                  placeholder="Nombre *"
                  className={inputClassName}
                  required
                />
                <input
                  type="text"
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  placeholder="Descripción"
                  className={inputClassName}
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                  placeholder="Precio (EUR)"
                  className={inputClassName}
                />
                <button
                  type="submit"
                  disabled={creatingProduct || !newProduct.title.trim()}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creatingProduct ? 'Creando...' : 'Crear y añadir'}
                </button>
              </form>
            </div>

            <button
              onClick={() => setShowAddProduct(false)}
              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
