'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/contexts/UserContext'
import { insforge } from '@/lib/insforge'
import MobileDashboardNav from '@/app/dashboard/_components/MobileDashboardNav'

type Product = {
  id: string
  title: string
  description: string | null
  current_price: number | null
  created_at: string
  updated_at: string
}

type PriceHistory = {
  id: string
  product_id: string
  price: number
  created_at: string
  created_by: string | null
}

type ProductsCacheEntry = {
  savedAt: number
  products: Product[]
}

const PRODUCTS_CACHE_TTL_MS = 5 * 60 * 1000
const PRODUCTS_CACHE_PREFIX = 'products_cache_v1:'
const PRODUCTS_MIN_REFETCH_GAP_MS = 8 * 1000

function getSubFromAccessToken(token: string): string | null {
  try {
    const base64Url = token.split('.')[1]
    if (!base64Url) return null
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(atob(base64))
    return typeof json?.sub === 'string' && json.sub.trim() ? json.sub : null
  } catch {
    return null
  }
}

function getProductsCacheKey(userId: string) {
  return `${PRODUCTS_CACHE_PREFIX}${userId}`
}

function readCachedProducts(userId: string): Product[] | null {
  try {
    const raw = localStorage.getItem(getProductsCacheKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as ProductsCacheEntry
    if (!parsed?.savedAt || !Array.isArray(parsed?.products)) return null
    if (Date.now() - parsed.savedAt > PRODUCTS_CACHE_TTL_MS) return null
    return parsed.products
  } catch {
    return null
  }
}

function writeCachedProducts(userId: string, products: Product[]) {
  try {
    const payload: ProductsCacheEntry = { savedAt: Date.now(), products }
    localStorage.setItem(getProductsCacheKey(userId), JSON.stringify(payload))
  } catch {
    // Ignore storage write failures.
  }
}

function reconcileProducts(previous: Product[], incoming: Product[]) {
  const previousById = new Map(previous.map((item) => [item.id, item]))
  const reconciled = incoming.map((nextItem) => {
    const prevItem = previousById.get(nextItem.id)
    if (
      prevItem &&
      prevItem.title === nextItem.title &&
      prevItem.description === nextItem.description &&
      prevItem.current_price === nextItem.current_price &&
      prevItem.updated_at === nextItem.updated_at
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

const inputClassName =
  'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100'

export default function ProductsPage() {
  const router = useRouter()
  const { user, loading: authLoading, refreshUser } = useUser()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [newProduct, setNewProduct] = useState({ title: '', description: '', price: '' })
  const [creating, setCreating] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [editorForm, setEditorForm] = useState({ title: '', description: '' })
  const [savingProduct, setSavingProduct] = useState(false)
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([])
  const [editingHistory, setEditingHistory] = useState<Record<string, string>>({})
  const [newHistoryPrice, setNewHistoryPrice] = useState('')
  const [savingHistoryId, setSavingHistoryId] = useState<string | null>(null)
  const [deletingHistoryId, setDeletingHistoryId] = useState<string | null>(null)
  const [addingHistory, setAddingHistory] = useState(false)
  const [error, setError] = useState('')
  const lastFetchAtRef = useRef(0)
  const hydratedFromCacheRef = useRef(false)

  const applyProducts = useCallback(
    (nextProducts: Product[]) => {
      if (!user) return
      setProducts((previous) => {
        const reconciled = reconcileProducts(previous, nextProducts)
        if (reconciled !== previous) {
          writeCachedProducts(user.id, reconciled)
        }
        return reconciled
      })
    },
    [user]
  )

  const loadProducts = useCallback(async (options?: { force?: boolean; keepCurrentUI?: boolean }) => {
    if (!user) return
    const force = options?.force ?? false
    const keepCurrentUI = options?.keepCurrentUI ?? false
    const now = Date.now()
    if (!force && now - lastFetchAtRef.current < PRODUCTS_MIN_REFETCH_GAP_MS) {
      return
    }
    lastFetchAtRef.current = now

    if (!keepCurrentUI) {
      setLoading(true)
    }

    const { data, error } = await insforge.database
      .from('products')
      .select('*')
      .eq('created_by', user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      setError(error.message)
      applyProducts([])
    } else if (data) {
      applyProducts(data)
    }

    setLoading(false)
  }, [user, applyProducts])

  const loadHistory = useCallback(async (productId: string) => {
    const { data, error } = await insforge.database
      .from('price_history')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
      setPriceHistory([])
      setEditingHistory({})
      return
    }

    const history = data || []
    setPriceHistory(history)
    setEditingHistory(
      history.reduce<Record<string, string>>((acc, item) => {
        acc[item.id] = String(item.price)
        return acc
      }, {})
    )
  }, [])

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/sign-in')
    }
  }, [authLoading, user, router])

  useEffect(() => {
    if (user) {
      const cachedProducts = readCachedProducts(user.id)
      if (cachedProducts) {
        hydratedFromCacheRef.current = true
        queueMicrotask(() => {
          applyProducts(cachedProducts)
        })
      } else {
        hydratedFromCacheRef.current = false
      }

      queueMicrotask(() => {
        void loadProducts({ force: true, keepCurrentUI: hydratedFromCacheRef.current })
      })
    }
  }, [user, loadProducts, applyProducts])

  async function createProduct(e: React.FormEvent) {
    e.preventDefault()
    if (!newProduct.title.trim() || !user) return

    setCreating(true)
    setError('')
    const price = newProduct.price ? parseFloat(newProduct.price) : null

    const { data, error: insertError } = await insforge.database
      .from('products')
      .insert([
        {
          title: newProduct.title.trim(),
          description: newProduct.description.trim() || null,
          current_price: price,
        },
      ])
      .select('*')
      .single()

    if (insertError || !data) {
      setError(insertError?.message ?? 'No se pudo crear el producto.')
      setCreating(false)
      return
    }

    if (price !== null) {
      await insforge.database.from('price_history').insert([
        {
          product_id: data.id,
          price,
        },
      ])
    }

    setProducts([data, ...products])
    setNewProduct({ title: '', description: '', price: '' })
    setCreating(false)
  }

  async function openProductEditor(product: Product) {
    setError('')
    setSelectedProduct(product)
    setEditorForm({
      title: product.title,
      description: product.description || '',
    })
    setNewHistoryPrice(product.current_price !== null ? String(product.current_price) : '')
    setShowEditor(true)
    await loadHistory(product.id)
  }

  async function saveProductChanges() {
    if (!selectedProduct) return
    if (!editorForm.title.trim()) return

    setSavingProduct(true)
    setError('')
    const { data, error } = await insforge.database
      .from('products')
      .update({
        title: editorForm.title.trim(),
        description: editorForm.description.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedProduct.id)
      .select()
      .single()

    if (error) {
      setError(error.message)
      setSavingProduct(false)
      return
    }

    if (data) {
      setSelectedProduct(data)
      setProducts(products.map((product) => (product.id === data.id ? data : product)))
    }

    setSavingProduct(false)
  }

  async function addNewHistoryPrice() {
    if (!selectedProduct || !user) return
    const parsedPrice = Number(newHistoryPrice.replace(',', '.'))
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) return

    setAddingHistory(true)
    setError('')

    const { data: refreshedSession, error: refreshError } = await insforge.auth.refreshSession()
    if (!refreshError && refreshedSession?.accessToken) {
      insforge.getHttpClient().setAuthToken(refreshedSession.accessToken)
    }

    const refreshedSub = refreshedSession?.accessToken
      ? getSubFromAccessToken(refreshedSession.accessToken)
      : null
    const { data: currentUserData, error: currentUserError } = await insforge.auth.getCurrentUser()
    const sessionUserId = refreshedSub ?? (currentUserError ? null : currentUserData?.user?.id)
    if (!sessionUserId) {
      setError('Tu sesión expiró. Inicia sesión de nuevo para actualizar precios.')
      setAddingHistory(false)
      await refreshUser()
      router.push('/sign-in?redirect=/products')
      return
    }

    const { error: historyError } = await insforge.database.from('price_history').insert([
      {
        product_id: selectedProduct.id,
        price: parsedPrice,
        created_by: sessionUserId,
      },
    ])

    if (historyError) {
      setError(historyError.message)
      setAddingHistory(false)
      return
    }

    const { data: productData, error: productError } = await insforge.database
      .from('products')
      .update({
        current_price: parsedPrice,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedProduct.id)
      .select()
      .single()

    if (productError) {
      setError(productError.message)
      setAddingHistory(false)
      return
    }

    if (productData) {
      setSelectedProduct(productData)
      setProducts(products.map((product) => (product.id === productData.id ? productData : product)))
    }

    await loadHistory(selectedProduct.id)
    setAddingHistory(false)
  }

  async function saveHistoryEntry(entryId: string) {
    if (!selectedProduct) return
    const rawValue = editingHistory[entryId] ?? ''
    const parsedPrice = Number(rawValue.replace(',', '.'))
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) return

    setSavingHistoryId(entryId)
    setError('')

    const { error } = await insforge.database
      .from('price_history')
      .update({ price: parsedPrice })
      .eq('id', entryId)

    if (error) {
      setError(error.message)
      setSavingHistoryId(null)
      return
    }

    await loadHistory(selectedProduct.id)
    setSavingHistoryId(null)
  }

  async function deleteHistoryEntry(entryId: string) {
    if (!selectedProduct) return

    setDeletingHistoryId(entryId)
    setError('')

    const { error } = await insforge.database.from('price_history').delete().eq('id', entryId)

    if (error) {
      setError(error.message)
      setDeletingHistoryId(null)
      return
    }

    await loadHistory(selectedProduct.id)
    setDeletingHistoryId(null)
  }

  function closeEditor() {
    setShowEditor(false)
    setSelectedProduct(null)
    setPriceHistory([])
    setEditingHistory({})
    setNewHistoryPrice('')
  }

  if (authLoading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-xl">
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-orange-500" />
            <div>
              <p className="text-sm font-medium text-slate-900">Cargando productos</p>
              <p className="text-xs text-slate-500">Esto tarda solo unos segundos.</p>
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
          <header className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-xl sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-orange-500">Catalogo</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                  Productos
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  Toca un producto para editar nombre, descripcion e historial de precios.
                </p>
              </div>
              <Link
                href="/dashboard"
                className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Volver a listas
              </Link>
            </div>
          </header>

        <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-xl sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Nuevo producto</h2>
          <form onSubmit={createProduct} className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
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
              placeholder="Descripcion"
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
              disabled={creating || !newProduct.title.trim()}
              className="inline-flex items-center justify-center rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? 'Creando...' : 'Anadir producto'}
            </button>
          </form>
        </section>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {loading && products.length === 0 ? (
          <section className="grid gap-2.5 sm:grid-cols-2">
            {[0, 1, 2, 3, 4, 5].map((skeleton) => (
              <div
                key={skeleton}
                className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white/70"
              />
            ))}
          </section>
        ) : products.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center">
            <h2 className="text-xl font-semibold text-slate-900">No hay productos aun</h2>
            <p className="mt-2 text-sm text-slate-500">Anade el primero para empezar el historial de precios.</p>
          </section>
        ) : (
          <section className="grid gap-2.5 sm:grid-cols-2">
            {products.map((product) => (
              <button
                type="button"
                key={product.id}
                onClick={() => void openProductEditor(product)}
                className="rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-900">{product.title}</h3>
                  <span className="rounded-lg bg-orange-100 px-2 py-1 text-[11px] font-semibold text-orange-700">
                    Editar
                  </span>
                </div>
                {product.description && (
                  <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-slate-500">{product.description}</p>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Precio actual</p>
                  <p className="text-sm font-semibold text-emerald-600">
                    {product.current_price !== null ? `${product.current_price.toFixed(2)} EUR` : '-'}
                  </p>
                </div>
                <p className="mt-2.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Pulsa para abrir el editor completo
                </p>
              </button>
            ))}
          </section>
        )}
        </div>

        {showEditor && selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-end bg-slate-900/50 p-3 sm:items-center sm:justify-center sm:p-6">
            <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">Editar producto</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Cambia datos basicos y administra el historial de precios.
                  </p>
                </div>
                <button
                  onClick={closeEditor}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-50"
                >
                  Cerrar
                </button>
              </div>

              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="mb-3 text-sm font-semibold text-slate-700">Datos del producto</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    value={editorForm.title}
                    onChange={(e) => setEditorForm({ ...editorForm, title: e.target.value })}
                    placeholder="Nombre"
                    className={inputClassName}
                  />
                  <input
                    type="text"
                    value={editorForm.description}
                    onChange={(e) => setEditorForm({ ...editorForm, description: e.target.value })}
                    placeholder="Descripcion"
                    className={inputClassName}
                  />
                </div>
                <button
                  onClick={() => void saveProductChanges()}
                  disabled={savingProduct || !editorForm.title.trim()}
                  className="mt-3 inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingProduct ? 'Guardando...' : 'Guardar nombre y descripcion'}
                </button>
              </section>

              <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-slate-700">Historial de precios</h4>
                  <p className="text-sm font-semibold text-emerald-600">
                    Actual:{' '}
                    {selectedProduct.current_price !== null
                      ? `${selectedProduct.current_price.toFixed(2)} EUR`
                      : '-'}
                  </p>
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newHistoryPrice}
                    onChange={(e) => setNewHistoryPrice(e.target.value)}
                    placeholder="Nuevo precio"
                    className={inputClassName}
                  />
                  <button
                    onClick={() => void addNewHistoryPrice()}
                    disabled={!newHistoryPrice || addingHistory}
                    className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {addingHistory ? 'Anadiendo...' : 'Anadir al historial'}
                  </button>
                </div>

                <div className="mt-4 max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
                  {priceHistory.length === 0 ? (
                    <p className="p-2 text-sm text-slate-500">Sin historial disponible.</p>
                  ) : (
                    priceHistory.map((historyEntry) => (
                      <div
                        key={historyEntry.id}
                        className="rounded-xl border border-slate-200 bg-white p-3"
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            {new Date(historyEntry.created_at).toLocaleDateString('es-ES', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                          <span className="text-xs font-semibold text-slate-500">
                            ID: {historyEntry.id.slice(0, 8)}
                          </span>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editingHistory[historyEntry.id] ?? ''}
                            onChange={(e) =>
                              setEditingHistory({
                                ...editingHistory,
                                [historyEntry.id]: e.target.value,
                              })
                            }
                            className={inputClassName}
                          />
                          <button
                            onClick={() => void saveHistoryEntry(historyEntry.id)}
                            disabled={savingHistoryId === historyEntry.id}
                            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {savingHistoryId === historyEntry.id ? 'Guardando...' : 'Guardar'}
                          </button>
                          <button
                            onClick={() => void deleteHistoryEntry(historyEntry.id)}
                            disabled={deletingHistoryId === historyEntry.id}
                            className="inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingHistoryId === historyEntry.id ? 'Eliminando...' : 'Eliminar'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </main>

      <MobileDashboardNav />
    </>
  )
}
