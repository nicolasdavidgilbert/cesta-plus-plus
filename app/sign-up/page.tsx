'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/contexts/UserContext'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { PremiumInput } from '@/components/auth/PremiumInput'

const onboardingHighlights = [
  { title: 'Registro rápido', description: 'Empieza en menos de 1 minuto desde móvil.' },
  { title: 'Listas compartidas', description: 'Coordina compras con familia y pareja en tiempo real.' },
  { title: 'Historial de precios', description: 'Compra con mejor criterio cada semana.' },
]

const previewChecklist = [
  { item: 'Leche', qty: '2 ud', done: true },
  { item: 'Pan', qty: '1 ud', done: true },
  { item: 'Tomate', qty: '4 ud', done: false },
  { item: 'Pasta', qty: '2 paq', done: false },
]

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

  const marketingElement = (
    <div className="space-y-8">
      <div className="space-y-4">
        <span className="inline-flex rounded-full bg-[#fb923c]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#fb923c] ring-1 ring-[#fb923c]/20">
          Experiencia de compra
        </span>
        <h2 className="text-4xl font-bold leading-[1.1] text-white bg-clip-text text-transparent bg-gradient-to-br from-white via-white/90 to-white/60">
          Organiza tu hogar <br />
          en segundos.
        </h2>
        <p className="max-w-md text-lg leading-relaxed text-slate-400">
          Cesta++ está diseñada para el día a día: crea listas, comparte y ahorra tiempo.
        </p>
      </div>

      {/* Interactive Preview */}
      <div className="bg-white/10 backdrop-blur-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.2)] [background:linear-gradient(135deg,rgba(255,255,255,0.1),rgba(255,255,255,0.05))] rounded-[2.5rem] p-6 shadow-2xl animate-pulse">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-bold text-white uppercase tracking-widest">Lista Semanal</p>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">4 items</span>
        </div>
        <ul className="space-y-3">
          {previewChecklist.map((row) => (
            <li
              key={row.item}
              className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 px-4 py-3 transition-colors hover:bg-white/10"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-lg border text-[10px] font-bold transition-all ${
                    row.done
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-white/20 bg-white/5 text-transparent'
                  }`}
                >
                  ✓
                </div>
                <span
                  className={`text-sm font-medium transition-all ${
                    row.done ? 'text-slate-500 line-through decoration-[#fb923c]/50' : 'text-white'
                  }`}
                >
                  {row.item}
                </span>
              </div>
              <span className="text-[11px] font-bold text-[#fb923c] bg-[#fb923c]/10 px-2 py-0.5 rounded-full">{row.qty}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {onboardingHighlights.map((h) => (
          <div key={h.title} className="rounded-2xl border border-white/5 bg-white/5 p-4 backdrop-blur-sm">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-1">{h.title}</h3>
            <p className="text-[10px] leading-relaxed text-slate-400">{h.description}</p>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <AuthLayout
      title={showVerification ? 'Verifica tu cuenta' : 'Crear Cuenta'}
      subtitle={
        showVerification 
          ? 'Introduce el código que enviamos a tu correo.' 
          : 'Únete hoy y empieza a gestionar tus compras como un profesional.'
      }
      marketing={marketingElement}
    >
      <div className="space-y-6">
        {/* Messages */}
        <div className="space-y-3">
          {error && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-400 font-medium animate-pulse">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
              {successMessage}
            </div>
          )}
        </div>

        {!showVerification ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            <PremiumInput
              label="Nombre completo"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
              required
              autoComplete="name"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              }
            />

            <PremiumInput
              label="Correo Electrónico"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@ejemplo.com"
              required
              autoComplete="email"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              }
            />

            <PremiumInput
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="new-password"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              }
            />

            <button
              type="submit"
              disabled={loading}
              className="group relative inline-flex w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#fb923c] to-[#f59e0b] px-4 py-4 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
              {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-6">
            <div className="rounded-2xl border border-white/5 bg-white/5 p-4 text-center">
              <p className="text-sm text-slate-400">
                Hemos enviado un código a <br />
                <strong className="text-white">{email}</strong>
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500 text-center block">
                Código de verificación
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full tracking-[1em] text-center font-mono text-3xl font-bold rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-white outline-none transition-all placeholder:text-slate-800 focus:border-[#fb923c] focus:bg-slate-900/50 focus:ring-4 focus:ring-[#fb923c]/10"
                maxLength={6}
                placeholder="000000"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="group relative inline-flex w-full items-center justify-center overflow-hidden rounded-2xl bg-[#fb923c] px-4 py-4 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
              {loading ? 'Verificando...' : 'Verificar Cuenta'}
            </button>
            
            <button 
              type="button"
              onClick={() => setShowVerification(false)}
              className="w-full text-center text-xs font-medium text-slate-500 hover:text-white transition-colors"
            >
              ← Volver al registro
            </button>
          </form>
        )}

        {!showVerification && (
          <p className="text-center text-sm text-slate-500">
            ¿Ya tienes una cuenta?{' '}
            <Link
              href={redirectPath === '/dashboard' ? '/sign-in' : `/sign-in?redirect=${encodeURIComponent(redirectPath)}`}
              className="font-bold text-[#fb923c] hover:text-[#f59e0b] transition-colors"
            >
              Inicia sesión
            </Link>
          </p>
        )}
      </div>
    </AuthLayout>
  )
}
