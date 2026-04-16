'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/contexts/UserContext'
import { insforge } from '@/lib/insforge'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { PremiumInput } from '@/components/auth/PremiumInput'

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
      setError('Google OAuth require HTTPS si no usas localhost.')
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
    <AuthLayout 
      title="Bienvenido" 
      subtitle="Accede a tus listas y empieza a ahorrar tiempo en tus compras."
    >
      <div className="space-y-6">
        {/* Status Messages */}
        <div className="space-y-3">
          {authStatus === 'success' && authType === 'verify_email' && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
              Email verificado. Ya puedes iniciar sesión.
            </div>
          )}

          {authStatus === 'error' && authType === 'verify_email' && authError && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-400 font-medium">
              {authError}
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-400 font-medium animate-pulse">
              {error}
            </div>
          )}
        </div>

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
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
            autoComplete="current-password"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            }
          />

          <div className="flex items-center justify-end">
            <Link href="#" className="text-xs font-medium text-slate-500 hover:text-brand-orange transition-colors">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group relative inline-flex w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-brand-orange to-brand-amber px-4 py-4 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="relative flex items-center gap-4">
          <div className="h-px flex-1 bg-white/5" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">O continuar con</span>
          <div className="h-px flex-1 bg-white/5" />
        </div>

        <button
          onClick={() => handleOAuth('google')}
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm font-semibold text-white transition-all hover:bg-white/10 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
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
          Google
        </button>

        <p className="text-center text-sm text-slate-500">
          ¿No tienes cuenta?{' '}
          <Link
            href={redirectPath === '/dashboard' ? '/sign-up' : `/sign-up?redirect=${encodeURIComponent(redirectPath)}`}
            className="font-bold text-brand-orange hover:text-brand-amber transition-colors"
          >
            Regístrate ahora
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
