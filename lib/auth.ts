import { createClient } from '@insforge/sdk'
import { cookies, headers } from 'next/headers'

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL!
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!

const accessCookie = 'insforge_access_token'
const refreshCookie = 'insforge_refresh_token'

const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7
}

export function createServerClient(accessToken?: string) {
  return createClient({
    baseUrl,
    anonKey,
    isServerMode: true,
    edgeFunctionToken: accessToken
  })
}

async function getServerAppOrigin() {
  const headerStore = await headers()
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host')
  const proto =
    headerStore.get('x-forwarded-proto') ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http')

  if (host) {
    return `${proto}://${host}`
  }

  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}

export async function setAuthCookies(accessToken: string, refreshToken: string) {
  const cookieStore = await cookies()
  cookieStore.set(accessCookie, accessToken, { ...authCookieOptions, maxAge: 60 * 15 })
  cookieStore.set(refreshCookie, refreshToken, authCookieOptions)
}

export async function getAuthCookies() {
  const cookieStore = await cookies()
  return {
    accessToken: cookieStore.get(accessCookie)?.value,
    refreshToken: cookieStore.get(refreshCookie)?.value
  }
}

export async function clearAuthCookies() {
  const cookieStore = await cookies()
  cookieStore.delete(accessCookie)
  cookieStore.delete(refreshCookie)
}

export async function getCurrentUser() {
  const { accessToken } = await getAuthCookies()
  if (!accessToken) return null

  const insforge = createServerClient(accessToken)
  const { data, error } = await insforge.auth.getCurrentUser()
  if (error || !data?.user) return null

  return data.user
}

export async function signIn(formData: FormData) {
  const insforge = createServerClient()
  const { data, error } = await insforge.auth.signInWithPassword({
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? '')
  })

  if (error || !data?.accessToken || !data?.refreshToken) {
    return { success: false, error: error?.message ?? 'Sign in failed.' }
  }

  await setAuthCookies(data.accessToken, data.refreshToken)
  return { success: true }
}

export async function signUp(formData: FormData) {
  const insforge = createServerClient()
  const redirectTo = new URL('/sign-in', await getServerAppOrigin()).toString()
  const { data, error } = await insforge.auth.signUp({
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
    name: String(formData.get('name') ?? '').trim(),
    redirectTo
  })

  if (error) {
    return { success: false, error: error.message }
  }

  if (data?.requireEmailVerification) {
    return { success: true, requireEmailVerification: true, verifyEmailMethod: 'code' }
  }

  if (data?.accessToken && data?.refreshToken) {
    await setAuthCookies(data.accessToken, data.refreshToken)
    return { success: true }
  }

  return { success: false, error: 'Registration failed.' }
}

export async function signOut() {
  await clearAuthCookies()
}

export async function verifyEmail(formData: FormData) {
  const insforge = createServerClient()
  const { data, error } = await insforge.auth.verifyEmail({
    email: String(formData.get('email') ?? '').trim(),
    otp: String(formData.get('code') ?? '')
  })

  if (error || !data?.accessToken || !data?.refreshToken) {
    return { success: false, error: error?.message ?? 'Verification failed.' }
  }

  await setAuthCookies(data.accessToken, data.refreshToken)
  return { success: true }
}

export async function signInWithOAuth(provider: string, redirectTo: string) {
  const insforge = createServerClient()
  await insforge.auth.signInWithOAuth({
    provider: provider as 'google',
    redirectTo
  })
}
