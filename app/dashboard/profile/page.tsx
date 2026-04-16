'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import MobileDashboardNav from '@/app/dashboard/_components/MobileDashboardNav'

type ProfileFields = {
  name: string
  avatar_url: string
  bio: string
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, loading, signOut, updateProfile } = useUser()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/sign-in')
    }
  }, [loading, user, router])

  async function handleSignOut() {
    await signOut()
    router.push('/sign-in')
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-[#fb923c]" />
          <p className="text-sm font-bold uppercase tracking-widest text-[#fb923c]">Sincronizando perfil</p>
        </div>
      </main>
    )
  }

  return (
    <>
      <main className="min-h-screen w-full px-4 sm:px-6 py-12 pb-40">
        <div className="mx-auto w-full max-w-4xl space-y-10">
          <header className="space-y-4">
             <Link
                href="/dashboard"
                className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 transition-all hover:bg-white/10 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3 transition-transform group-hover:-translate-x-1">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Regresar
              </Link>
            <div className="space-y-1">
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl bg-clip-text text-transparent bg-gradient-to-br from-white via-white/90 to-white/60">
                Tu Identidad
              </h1>
              <p className="text-sm text-slate-500 font-medium tracking-tight">Personaliza tu presencia y gestiona tu cuenta.</p>
            </div>
          </header>

          <div className="grid gap-8 lg:grid-cols-5">
            <div className="lg:col-span-3 space-y-8">
              <section className="rounded-[2.5rem] border border-white/10 bg-white/5 p-8 backdrop-blur-md">
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#fb923c] ml-1">Configuración Pública</span>
                <ProfileForm
                  key={`${user.id}:${user.updatedAt || 'static'}`}
                  initialProfile={{
                    name: typeof user.profile?.name === 'string' ? user.profile.name : '',
                    avatar_url: typeof user.profile?.avatar_url === 'string' ? user.profile.avatar_url : '',
                    bio: typeof user.profile?.bio === 'string' ? user.profile.bio : '',
                  }}
                  currentProfile={user.profile || {}}
                  onSave={updateProfile}
                />
              </section>
            </div>

            <div className="lg:col-span-2 space-y-8">
              <section className="rounded-[2.5rem] border border-white/10 bg-white/5 p-8 backdrop-blur-md space-y-8">
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#fb923c] ml-1">Detalles de Cuenta</span>
                <div className="space-y-4">
                  {[
                    { label: 'Correo Electrónico', value: user.email },
                    { label: 'Identificador Único', value: user.id },
                    { label: 'Estado de Verificación', value: user.emailVerified ? 'Verificado' : 'Pendiente' },
                    { label: 'Método de Acceso', value: user.providers?.join(', ') || 'N/A' },
                  ].map((item, idx) => (
                    <div key={idx} className="space-y-1 group">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">{item.label}</p>
                      <div className="rounded-2xl border border-white/5 bg-white/5 px-5 py-3 text-sm font-medium text-slate-300 ring-1 ring-white/5 transition-all group-hover:bg-white/10 group-hover:text-white truncate">
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-6 border-t border-white/5">
                  <button
                    onClick={handleSignOut}
                    className="group relative flex w-full items-center justify-center overflow-hidden rounded-2xl border border-rose-500/20 bg-rose-500/5 py-4 text-sm font-bold text-rose-500 transition-all hover:bg-rose-500 hover:text-white active:scale-95"
                  >
                    Cerrar Sesión Activa
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>

        <MobileDashboardNav />
      </main>
    </>
  )
}

function ProfileForm({
  initialProfile,
  currentProfile,
  onSave,
}: {
  initialProfile: ProfileFields
  currentProfile: Record<string, unknown>
  onSave: (profile: Record<string, unknown>) => Promise<{ error?: string }>
}) {
  const [profile, setProfile] = useState<ProfileFields>(initialProfile)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const inputClassName = "w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-[#fb923c]/40 focus:bg-white/10 focus:ring-4 focus:ring-[#fb923c]/5"

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    const payload: Record<string, unknown> = {
      ...currentProfile,
      name: profile.name.trim(),
      bio: profile.bio.trim(),
    }

    const avatar = profile.avatar_url.trim()
    if (avatar) {
      payload.avatar_url = avatar
    } else {
      delete payload.avatar_url
    }

    const result = await onSave(payload)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess('Tus cambios se han sincronizado correctamente.')
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      <div className="grid gap-6">
        <div className="space-y-4">
          <div className="flex flex-col gap-6 sm:flex-row">
            <div className="relative group">
              <div className="h-28 w-28 rounded-3xl overflow-hidden ring-4 ring-white/5 bg-slate-800 flex items-center justify-center transition-all group-hover:ring-[#fb923c]/20">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12 text-slate-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                )}
              </div>
            </div>
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 ml-1">Nombre Completo</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))}
                  className={inputClassName}
                  placeholder="Cómo te llamas..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 ml-1">URL de Avatar</label>
                <input
                  type="url"
                  value={profile.avatar_url}
                  onChange={(e) => setProfile((prev) => ({ ...prev, avatar_url: e.target.value }))}
                  className={inputClassName}
                  placeholder="https://tu-imagen.jpg"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 ml-1">Biografía Breve</label>
          <textarea
            value={profile.bio}
            onChange={(e) => setProfile((prev) => ({ ...prev, bio: e.target.value }))}
            className={`${inputClassName} h-32 resize-none`}
            placeholder="Cuenta algo sobre ti..."
          />
        </div>
      </div>

      <div className="pt-4 space-y-4">
        {error && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-6 py-4 text-sm font-medium text-rose-400">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-6 py-4 text-sm font-medium text-emerald-400">
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="group relative flex w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#fb923c] to-[#f59e0b] px-8 py-4 text-base font-bold text-white shadow-xl shadow-[#fb923c]/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 sm:w-auto"
        >
          <span className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
          {saving ? 'Guardando...' : 'Salvar Cambios'}
        </button>
      </div>
    </form>
  )
}

import Link from 'next/link'
