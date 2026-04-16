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
      <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-xl">
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-orange-500" />
            <div>
              <p className="text-sm font-medium text-slate-900">Cargando perfil</p>
              <p className="text-xs text-slate-500">Preparando tus datos.</p>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <>
      <main className="min-h-screen px-4 py-6 pb-28 sm:px-6">
        <div className="mx-auto w-full max-w-3xl space-y-4">
          <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-500">Perfil</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              Datos de usuario
            </h1>
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

          <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Información de cuenta
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Email</dt>
                <dd className="mt-1 break-all font-medium text-slate-900">{user.email}</dd>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <dt className="text-xs uppercase tracking-wide text-slate-500">ID</dt>
                <dd className="mt-1 break-all font-medium text-slate-900">{user.id}</dd>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Email verificado</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {user.emailVerified ? 'Sí' : 'No'}
                </dd>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Proveedores</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {user.providers?.length ? user.providers.join(', ') : 'N/A'}
                </dd>
              </div>
            </dl>
            <button
              onClick={handleSignOut}
              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
            >
              Cerrar sesión
            </button>
          </section>
        </div>
      </main>

      <MobileDashboardNav />
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
      setSuccess('Perfil guardado.')
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-3">
      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Nombre</span>
        <input
          type="text"
          value={profile.name}
          onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Avatar URL</span>
        <input
          type="url"
          value={profile.avatar_url}
          onChange={(e) => setProfile((prev) => ({ ...prev, avatar_url: e.target.value }))}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
          placeholder="https://..."
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Bio</span>
        <textarea
          value={profile.bio}
          onChange={(e) => setProfile((prev) => ({ ...prev, bio: e.target.value }))}
          className="h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
          placeholder="Sobre ti..."
        />
      </label>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex w-full items-center justify-center rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {saving ? 'Guardando...' : 'Guardar perfil'}
      </button>
    </form>
  )
}
