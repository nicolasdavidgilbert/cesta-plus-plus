'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'

export default function HomePage() {
  const router = useRouter()
  const { user, loading } = useUser()

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push('/dashboard')
      } else {
        router.push('/sign-in')
      }
    }
  }, [user, loading, router])

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-500">Cesta++</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Preparando tu espacio
            </h1>
            <p className="text-sm leading-6 text-slate-500">
              Estamos comprobando tu sesión para llevarte a la pantalla correcta.
            </p>
          </div>
          <div className="h-12 w-12 shrink-0 rounded-2xl bg-orange-100" />
        </div>
        <div className="mt-6 flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-orange-500" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-900">Cargando</p>
            <p className="text-xs text-slate-500">Esto tarda solo unos segundos.</p>
          </div>
        </div>
      </section>
    </main>
  )
}
