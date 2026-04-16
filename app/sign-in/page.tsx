'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/contexts/UserContext'
import { insforge } from '@/lib/insforge'

const inputClassName =
  'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100'

export default function SignInPage() {
  const router = useRouter()
  const { signIn } = useUser()
  const initialSearchParams =
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [authStatus] = useState<string | null>(
    initialSearchParams?.get('insforge_status') ?? null
  )
  const [authType] = useState<string | null>(initialSearchParams?.get('insforge_type') ?? null)
  const [authError] = useState<string | null>(initialSearchParams?.get('insforge_error') ?? null)
  const [redirectPath] = useState<string>(() => {
    const redirect = initialSearchParams?.get('redirect') ?? ''
    return redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/dashboard'
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await signIn(email, password)
    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.push(redirectPath)
    }
  }

  async function handleOAuth(provider: string) {
    setError('')
    setLoading(true)

    const hostname = window.location.hostname
    const isLocalhost =
      hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
    if (!window.isSecureContext && !isLocalhost) {
      setError('Google OAuth requiere HTTPS si no usas localhost.')
      setLoading(false)
      return
    }

    const { error } = await insforge.auth.signInWithOAuth({
      provider,
      redirectTo: `${window.location.origin}${redirectPath}`,
    })

    if (error) {
      if (error.message === 'An unexpected error occurred during OAuth initialization') {
        setError('OAuth no se pudo iniciar. Usa HTTPS o abre la app en localhost.')
      } else {
        setError(error.message)
      }
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-2">
        <section className="order-2 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl sm:p-8 lg:order-1">
          <div className="mb-8 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-500">Acceso</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Iniciar sesión
            </h1>
            <p className="text-sm leading-6 text-slate-500">
              Accede con tu correo o usa Google para entrar más rápido.
            </p>
          </div>

          <div className="space-y-3">
            {authStatus === 'success' && authType === 'verify_email' && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Email verificado. Ya puedes iniciar sesión.
              </div>
            )}

            {authStatus === 'error' && authType === 'verify_email' && authError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {authError}
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClassName}
                placeholder="tu@email.com"
                required
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Contraseña</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClassName}
                placeholder="Tu contraseña"
                required
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-medium uppercase tracking-widest text-slate-400">o</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            onClick={() => handleOAuth('google')}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continuar con Google
          </button>

          <p className="mt-6 text-center text-sm text-slate-500">
            ¿No tienes cuenta?{' '}
            <Link
              href={redirectPath === '/dashboard' ? '/sign-up' : `/sign-up?redirect=${encodeURIComponent(redirectPath)}`}
              className="font-semibold text-orange-600 hover:text-orange-700"
            >
              Regístrate
            </Link>
          </p>
        </section>

        <section className="order-1 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-orange-600 p-6 text-white shadow-2xl sm:p-8 lg:order-2">
          <div className="flex h-full flex-col justify-between gap-8">
            <div className="space-y-4">
              <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-orange-100">
                Compra inteligente
              </span>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Control total de tus listas desde móvil.
              </h2>
              <p className="max-w-xl text-sm leading-6 text-slate-200">
                Cesta++ te ayuda a crear listas rápidas, comparar precios y tener historial de productos
                sin perder tiempo.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <article className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                <p className="text-2xl font-semibold">1 min</p>
                <p className="mt-1 text-xs text-slate-200">Crear una lista nueva.</p>
              </article>
              <article className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                <p className="text-2xl font-semibold">+Precio</p>
                <p className="mt-1 text-xs text-slate-200">Historial por producto.</p>
              </article>
              <article className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                <p className="text-2xl font-semibold">100%</p>
                <p className="mt-1 text-xs text-slate-200">Diseño mobile-first.</p>
              </article>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
