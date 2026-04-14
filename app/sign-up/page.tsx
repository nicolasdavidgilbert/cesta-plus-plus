'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/contexts/UserContext'

const inputClassName =
  'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100'

export default function SignUpPage() {
  const router = useRouter()
  const { signUp, verifyEmail } = useUser()
  const initialSearchParams =
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showVerification, setShowVerification] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [redirectPath] = useState<string>(() => {
    const redirect = initialSearchParams?.get('redirect') ?? ''
    return redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/dashboard'
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await signUp(email, password, name)
    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else if (result.requireVerification) {
      setShowVerification(true)
      setLoading(false)
    } else {
      router.push(redirectPath)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await verifyEmail(email, code)
    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setSuccessMessage('Email verificado. Redirigiendo...')
      router.push(redirectPath)
    }
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-2">
        <section className="order-2 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl sm:p-8 lg:order-2">
          <div className="mb-8 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-500">Registro</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              {showVerification ? 'Verifica tu email' : 'Crear cuenta'}
            </h1>
            <p className="text-sm leading-6 text-slate-500">
              {showVerification
                ? 'Introduce el código recibido para activar tu cuenta.'
                : 'Crea tu cuenta y empieza a gestionar tus compras con una interfaz mobile-first.'}
            </p>
          </div>

          <div className="space-y-3">
            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {successMessage}
              </div>
            )}
          </div>

          {!showVerification ? (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Nombre</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClassName}
                  placeholder="Tu nombre"
                  required
                />
              </label>

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
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
                <p className="text-xs text-slate-400">Mínimo 6 caracteres.</p>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Creando cuenta...' : 'Crear cuenta'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="mt-6 space-y-4">
              <p className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-4 text-sm leading-6 text-slate-600">
                Te enviamos un código de 6 dígitos a <strong className="text-slate-900">{email}</strong>.
              </p>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Código</span>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-3xl font-semibold tracking-widest text-slate-900 outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                  maxLength={6}
                  placeholder="000000"
                  required
                />
              </label>
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Verificando...' : 'Verificar'}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-slate-500">
            ¿Ya tienes cuenta?{' '}
            <Link
              href={redirectPath === '/dashboard' ? '/sign-in' : `/sign-in?redirect=${encodeURIComponent(redirectPath)}`}
              className="font-semibold text-orange-600 hover:text-orange-700"
            >
              Iniciar sesión
            </Link>
          </p>
        </section>

        <section className="order-1 rounded-3xl bg-gradient-to-br from-orange-500 via-orange-500 to-amber-600 p-6 text-white shadow-2xl sm:p-8 lg:order-1">
          <div className="flex h-full flex-col justify-between gap-8">
            <div className="space-y-4">
              <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-orange-100">
                Nuevo comienzo
              </span>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Crea listas de compra claras y rápidas.
              </h2>
              <p className="max-w-xl text-sm leading-6 text-orange-50">
                Diseñamos esta experiencia para usar en móvil sin fricción: añadir productos, marcar items
                y revisar precios en segundos.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <article className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                <p className="text-lg font-semibold">Listas vivas</p>
                <p className="mt-1 text-xs text-orange-50">Marca y organiza cada compra al instante.</p>
              </article>
              <article className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                <p className="text-lg font-semibold">Control de precio</p>
                <p className="mt-1 text-xs text-orange-50">Historial para decidir mejor cada compra.</p>
              </article>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
