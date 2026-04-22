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
  'w-full rounded-2xl border border-border bg-muted/40 px-6 py-4 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-secondary/40 focus:bg-muted/60 focus:ring-4 focus:ring-secondary/5'

export default function ProductsPage() {
  const router = useRouter()
  const { user, loading: authLoading, refreshUser } = useUser()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [newProduct, setNewProduct] = useState({ title: '', description: '', price: '' })
  const [creating, setCreating] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
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

    setProducts((previous) => {
      const nextProducts = [data, ...previous]
      writeCachedProducts(user.id, nextProducts)
      return nextProducts
    })
    setNewProduct({ title: '', description: '', price: '' })
    setShowCreateModal(false)
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

  const normalizedSearch = search.trim().toLowerCase()
  const filteredProducts = normalizedSearch
    ? products.filter((product) => {
        const title = product.title.toLowerCase()
        const description = product.description?.toLowerCase() ?? ''
        return title.includes(normalizedSearch) || description.includes(normalizedSearch)
      })
    : products

  if (authLoading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-border border-t-secondary" />
          <p className="text-sm font-bold uppercase tracking-widest text-secondary">Sincronizando productos</p>
        </div>
      </main>
    )
  }

  return (
    <>
      <main className="min-h-screen w-full px-4 sm:px-6 py-12 pb-40">
        <div className="mx-auto w-full max-w-6xl space-y-12">
          <header className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="space-y-4">
                <Link
                  href="/dashboard"
                  className="group inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-all hover:bg-muted/60 hover:text-foreground"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3 transition-transform group-hover:-translate-x-1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                  </svg>
                  Volver a Listas
                </Link>
                <div className="space-y-1">
                  <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl bg-clip-text text-transparent bg-gradient-to-br from-foreground via-foreground/90 to-foreground/60">
                    Catálogo Maestro
                  </h1>
                  <p className="text-sm text-muted-foreground font-medium tracking-tight">Gestiona productos, descripciones y haz seguimiento histórico de precios.</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="group relative flex-1">
                <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-muted-foreground group-focus-within:text-secondary transition-colors">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </div>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Busca por nombre o descripción..."
                  className="w-full rounded-2xl border border-border bg-muted/20 py-4 pl-14 pr-6 text-sm text-foreground placeholder-muted-foreground outline-none backdrop-blur-md transition-all focus:border-secondary/50 focus:bg-muted/40 focus:ring-4 focus:ring-secondary/10"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-secondary to-secondary/80 text-secondary-foreground shadow-xl shadow-secondary/20 transition-all hover:scale-105 active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            </div>
          </header>

          {error && (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-6 py-4 text-sm font-medium text-destructive backdrop-blur-md">
              {error}
            </div>
          )}

          {loading && products.length === 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-40 animate-pulse rounded-3xl border border-border bg-muted/40" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
              <div className="h-24 w-24 flex items-center justify-center rounded-[2rem] bg-muted/40 text-muted-foreground ring-1 ring-border/20">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25-2.25M12 13.875V7.5M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-foreground tracking-tight">
                  {products.length === 0 ? 'Catálogo sin ítems' : 'Sin resultados'}
                </h2>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                  {products.length === 0
                    ? 'Tus productos creados aparecerán aquí para ser reutilizados en cualquier lista.'
                    : 'Prueba con otros términos de búsqueda.'}
                </p>
              </div>
              {products.length === 0 && (
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center justify-center rounded-xl bg-muted/40 px-6 py-3 text-sm font-bold text-foreground ring-1 ring-border/20 transition-all hover:bg-muted/60 active:scale-95"
                >
                  Crear mi primer producto
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((product) => (
                <button
                  type="button"
                  key={product.id}
                  onClick={() => void openProductEditor(product)}
                  className="group relative flex flex-col items-start rounded-[2rem] border border-border bg-muted/20 p-6 text-left backdrop-blur-sm transition-all hover:bg-muted/40 hover:border-secondary/30 hover:-translate-y-1"
                >
                  <div className="w-full flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="text-lg font-bold text-foreground leading-tight tracking-tight group-hover:text-secondary transition-colors">{product.title}</h3>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                        Actualizado: {new Date(product.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="h-10 w-10 flex items-center justify-center rounded-2xl bg-muted/40 text-secondary ring-1 ring-border/20 transition-all group-hover:bg-secondary group-hover:text-secondary-foreground">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </div>
                  </div>

                  {product.description && (
                    <p className="mt-4 line-clamp-2 text-xs font-medium text-muted-foreground leading-relaxed">
                      {product.description}
                    </p>
                  )}

                  <div className="mt-8 pt-6 border-t border-border w-full flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Último Precio</span>
                    <span className="text-xl font-black text-foreground">
                      {product.current_price !== null ? `${product.current_price.toFixed(2)}` : '-'}
                      <span className="text-[10px] ml-1 text-secondary">EUR</span>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {!showCreateModal && (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="fixed bottom-28 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-secondary to-secondary/80 text-secondary-foreground shadow-xl shadow-secondary/40 transition-all hover:scale-110 active:scale-90 sm:hidden"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        )}

        {showCreateModal && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-background/80 backdrop-blur-sm p-4 sm:items-center sm:p-6">
            <div className="w-full max-w-xl animate-in slide-in-from-bottom duration-300 rounded-[2.5rem] border border-border bg-muted p-8 shadow-2xl">
              <div className="mb-8 flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold text-foreground tracking-tight">Nuevo Producto</h2>
                  <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Añade tu producto al catálogo</p>
                </div>
                <button
                  type="button"
                  onClick={() => !creating && setShowCreateModal(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/40 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={createProduct} className="space-y-4">
                <div className="space-y-2">
                  <label className="ml-1 text-xs font-bold uppercase tracking-widest text-secondary">Nombre del producto</label>
                  <input
                    type="text"
                    value={newProduct.title}
                    onChange={(e) => setNewProduct({ ...newProduct, title: e.target.value })}
                    placeholder="Ej: Leche semidesnatada"
                    className={inputClassName}
                    autoFocus
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="ml-1 text-xs font-bold uppercase tracking-widest text-secondary">Descripción</label>
                  <input
                    type="text"
                    value={newProduct.description}
                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                    placeholder="Marca, tamaño o notas..."
                    className={inputClassName}
                  />
                </div>

                <div className="space-y-2">
                  <label className="ml-1 text-xs font-bold uppercase tracking-widest text-secondary">Precio inicial (EUR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                    placeholder="0.00"
                    className={inputClassName}
                  />
                </div>

                <button
                  type="submit"
                  disabled={creating || !newProduct.title.trim()}
                  className="group relative mt-2 flex w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-secondary to-secondary/80 px-6 py-4 text-base font-bold text-secondary-foreground shadow-xl shadow-secondary/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:grayscale disabled:hover:scale-100"
                >
                  <span className="absolute inset-0 bg-foreground/10 opacity-0 transition-opacity group-hover:opacity-100" />
                  {creating ? 'Creando producto...' : 'Crear producto'}
                </button>
              </form>
            </div>
          </div>
        )}

        {showEditor && selectedProduct && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/90 backdrop-blur-md p-0 sm:p-6 lg:p-12">
            <div className="w-full max-w-5xl h-full sm:h-auto sm:max-h-[90vh] flex flex-col rounded-none sm:rounded-[2.5rem] border border-border bg-muted shadow-2xl overflow-hidden">
              <div className="p-6 sm:p-8 border-b border-border flex items-center justify-between bg-foreground/[0.02]">
                <div className="space-y-1">
                  <h3 className="text-2xl font-bold text-foreground tracking-tight">Detalle del Producto</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-secondary">ID: {selectedProduct.id.slice(0, 8)}</p>
                </div>
                <button
                  onClick={closeEditor}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-8 sm:space-y-10">
                <section className="space-y-6">
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">Atributos Básicos</span>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground ml-1">Nombre</label>
                      <input
                        type="text"
                        value={editorForm.title}
                        onChange={(e) => setEditorForm({ ...editorForm, title: e.target.value })}
                        placeholder="Nombre"
                        className={inputClassName}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground ml-1">Descripción</label>
                      <input
                        type="text"
                        value={editorForm.description}
                        onChange={(e) => setEditorForm({ ...editorForm, description: e.target.value })}
                        placeholder="Notas adicionales..."
                        className={inputClassName}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => void saveProductChanges()}
                    disabled={savingProduct || !editorForm.title.trim()}
                    className="flex items-center justify-center rounded-2xl bg-foreground px-8 py-3 text-sm font-bold text-background transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                  >
                    {savingProduct ? 'Guardando...' : 'Actualizar Información'}
                  </button>
                </section>

                <section className="space-y-6 pt-10 border-t border-border">
                  <div className="flex items-end justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">Historial de Precios</span>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Valor de Mercado Actual</p>
                      <p className="text-3xl font-black text-primary">
                        {selectedProduct.current_price !== null ? `${selectedProduct.current_price.toFixed(2)}` : '-'}
                        <span className="text-xs ml-1">EUR</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 sm:flex-row bg-muted/20 p-5 sm:p-6 rounded-3xl ring-1 ring-border/20">
                    <div className="flex-1 space-y-2">
                      <label className="text-xs font-bold text-muted-foreground ml-1">Nuevo Punto de Precio</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newHistoryPrice}
                        onChange={(e) => setNewHistoryPrice(e.target.value)}
                        placeholder="0.00"
                        className={inputClassName}
                      />
                    </div>
                    <button
                      onClick={() => void addNewHistoryPrice()}
                      disabled={!newHistoryPrice || addingHistory}
                      className="group relative flex items-center justify-center overflow-hidden rounded-2xl bg-secondary px-8 py-4 text-sm font-bold text-secondary-foreground shadow-xl shadow-secondary/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 self-end"
                    >
                      {addingHistory ? 'Registrando...' : 'Registrar Precio'}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {priceHistory.length === 0 ? (
                      <p className="py-12 text-center text-xs text-muted-foreground font-medium italic bg-muted/20 rounded-[2rem]">Sin registros históricos aún.</p>
                    ) : (
                      <div className="grid gap-3">
                        {priceHistory.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between rounded-2xl bg-muted/40 p-4 ring-1 ring-border/20 hover:bg-muted/60 transition-all"
                          >
                            <div className="space-y-1 min-w-[140px]">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">Fecha de Registro</p>
                              <p className="text-xs font-bold text-foreground">
                                {new Date(entry.created_at).toLocaleDateString()} · {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>

                            <div className="flex flex-1 items-center gap-3">
                              <input
                                type="number"
                                step="0.01"
                                value={editingHistory[entry.id] ?? ''}
                                onChange={(e) => setEditingHistory({ ...editingHistory, [entry.id]: e.target.value })}
                                className="h-10 grow rounded-xl border border-border bg-muted/20 px-4 text-sm text-foreground outline-none focus:border-secondary/40"
                              />
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => void saveHistoryEntry(entry.id)}
                                  disabled={savingHistoryId === entry.id}
                                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/40 text-primary hover:bg-primary/20 transition-all"
                                  title="Guardar cambios"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => void deleteHistoryEntry(entry.id)}
                                  disabled={deletingHistoryId === entry.id}
                                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/40 text-destructive hover:bg-destructive/20 transition-all"
                                  title="Eliminar entrada"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}

        <MobileDashboardNav />
      </main>
    </>
  )
}
