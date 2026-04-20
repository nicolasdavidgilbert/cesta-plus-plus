'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { insforge } from '@/lib/insforge'

type UserProfile = {
  name?: string
  avatar_url?: string
  [key: string]: unknown
}

type User = {
  id: string
  email: string
  emailVerified?: boolean
  providers?: string[]
  createdAt?: string
  updatedAt?: string
  profile?: UserProfile | null
  metadata?: Record<string, unknown> | null
  name?: string
}

type UserContextType = {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string, name: string) => Promise<{ error?: string; requireVerification?: boolean }>
  signOut: () => Promise<void>
  verifyEmail: (email: string, code: string) => Promise<{ error?: string }>
  refreshUser: () => Promise<void>
  updateProfile: (profile: Record<string, unknown>) => Promise<{ error?: string }>
}

const UserContext = createContext<UserContextType | null>(null)

const ACCESS_TOKEN_COOKIE = 'insforge_client_access_token'
const REFRESH_TOKEN_COOKIE = 'insforge_client_refresh_token'
const ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 15
const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7
const SESSION_REFRESH_INTERVAL_MS = 8 * 60 * 1000

type RefreshResult =
  | { ok: true }
  | { ok: false; reason: 'auth' | 'transient' }

type ErrorLike = {
  statusCode?: unknown
  error?: unknown
  message?: unknown
}

function getAppOrigin() {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin
  }

  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null

  const cookie = document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`))

  if (!cookie) return null

  const value = cookie.slice(name.length + 1)
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function writeCookie(name: string, value: string, maxAge: number) {
  if (typeof document === 'undefined') return

  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`
}

function deleteCookie(name: string) {
  if (typeof document === 'undefined') return

  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
}

function isProtectedPath(pathname: string) {
  return pathname.startsWith('/dashboard') || pathname.startsWith('/products') || pathname.startsWith('/invite')
}

function redirectToLogin() {
  if (typeof window === 'undefined') return
  const pathname = window.location.pathname
  if (pathname.startsWith('/sign-in')) return

  const redirect = `${pathname}${window.location.search || ''}`
  const params = new URLSearchParams()
  params.set('redirect', redirect)
  params.set('session_expired', '1')
  window.location.replace(`/sign-in?${params.toString()}`)
}

function isAuthSessionError(error: unknown) {
  const details = (error ?? {}) as ErrorLike
  const statusCode = typeof details.statusCode === 'number' ? details.statusCode : null
  const errorCode = typeof details.error === 'string' ? details.error.toUpperCase() : ''
  const errorMessage = (() => {
    if (typeof details.message === 'string') return details.message.toLowerCase()
    if (error instanceof Error && typeof error.message === 'string') return error.message.toLowerCase()
    return ''
  })()

  if (statusCode === 401 || statusCode === 403) return true
  if (errorCode === 'INVALID_TOKEN' || errorCode === 'UNAUTHORIZED' || errorCode === 'TOKEN_EXPIRED') return true
  if (errorMessage.includes('sesión no válida') || errorMessage.includes('session invalid')) return true
  if (errorMessage.includes('unauthorized') || errorMessage.includes('invalid token')) return true
  if (errorMessage.includes('refresh token') && errorMessage.includes('invalid')) return true
  if (errorMessage.includes('token expired')) return true

  return false
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const redirectedAfterRefreshFailureRef = useRef(false)

  function normalizeUser(raw: unknown): User {
    const userData = raw as User
    const profileName = userData.profile?.name
    return {
      ...userData,
      name: typeof profileName === 'string' && profileName.trim() ? profileName.trim() : userData.name,
    }
  }

  const persistTokens = useCallback((accessToken?: string | null, refreshToken?: string | null) => {
    if (accessToken) {
      writeCookie(ACCESS_TOKEN_COOKIE, accessToken, ACCESS_TOKEN_MAX_AGE_SECONDS)
      insforge.getHttpClient().setAuthToken(accessToken)
    }

    if (refreshToken) {
      writeCookie(REFRESH_TOKEN_COOKIE, refreshToken, REFRESH_TOKEN_MAX_AGE_SECONDS)
      insforge.getHttpClient().setRefreshToken(refreshToken)
    }
  }, [])

  const hydrateTokensFromCookies = useCallback(() => {
    const accessToken = readCookie(ACCESS_TOKEN_COOKIE)
    const refreshToken = readCookie(REFRESH_TOKEN_COOKIE)

    // Do not clobber an in-memory OAuth session with null when cookies are not yet written.
    if (accessToken) {
      insforge.getHttpClient().setAuthToken(accessToken)
    }
    if (refreshToken) {
      insforge.getHttpClient().setRefreshToken(refreshToken)
    }

    return { accessToken, refreshToken }
  }, [])

  const clearTokenCookies = useCallback(() => {
    deleteCookie(ACCESS_TOKEN_COOKIE)
    deleteCookie(REFRESH_TOKEN_COOKIE)
    insforge.getHttpClient().setAuthToken(null)
    insforge.getHttpClient().setRefreshToken(null)
  }, [])

  const handleRefreshFailure = useCallback(async () => {
    clearTokenCookies()
    setUser(null)

    if (typeof window !== 'undefined' && isProtectedPath(window.location.pathname) && !redirectedAfterRefreshFailureRef.current) {
      redirectedAfterRefreshFailureRef.current = true
      redirectToLogin()
    }
  }, [clearTokenCookies])

  const refreshSession = useCallback(async (): Promise<RefreshResult> => {
    try {
      const refreshResponse = await insforge.getHttpClient().handleTokenRefresh()
      persistTokens(
        refreshResponse.accessToken ?? null,
        refreshResponse.refreshToken ?? readCookie(REFRESH_TOKEN_COOKIE)
      )

      if (refreshResponse.user) {
        setUser(normalizeUser(refreshResponse.user))
      }

      return { ok: true }
    } catch (error) {
      if (isAuthSessionError(error)) {
        await handleRefreshFailure()
        return { ok: false, reason: 'auth' }
      }

      return { ok: false, reason: 'transient' }
    }
  }, [handleRefreshFailure, persistTokens])

  const checkUser = useCallback(async () => {
    redirectedAfterRefreshFailureRef.current = false
    hydrateTokensFromCookies()

    const { data, error } = await insforge.auth.getCurrentUser()

    if (!error && data?.user) {
      setUser(normalizeUser(data.user))
      setLoading(false)
      return
    }

    if (error) {
      if (isAuthSessionError(error)) {
        await handleRefreshFailure()
        setLoading(false)
        return
      }

      const refreshed = await refreshSession()
      if (!refreshed.ok) {
        if (refreshed.reason === 'transient') {
          const { data: retryData, error: retryError } = await insforge.auth.getCurrentUser()
          if (!retryError && retryData?.user) {
            setUser(normalizeUser(retryData.user))
          }
        }
        setLoading(false)
        return
      }

      const { data: refreshedUserData, error: refreshedUserError } = await insforge.auth.getCurrentUser()
      if (!refreshedUserError && refreshedUserData?.user) {
        setUser(normalizeUser(refreshedUserData.user))
      } else {
        setUser(null)
      }
    } else {
      setUser(null)
    }

    setLoading(false)
  }, [handleRefreshFailure, hydrateTokensFromCookies, refreshSession])

  useEffect(() => {
    queueMicrotask(() => {
      void checkUser()
    })
  }, [checkUser])

  useEffect(() => {
    if (!user) return

    const refreshNow = () => {
      void refreshSession()
    }

    const intervalId = window.setInterval(refreshNow, SESSION_REFRESH_INTERVAL_MS)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshNow()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [user, refreshSession])

  async function signIn(email: string, password: string) {
    const { data, error } = await insforge.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    if (data?.user) {
      persistTokens(data.accessToken ?? null, data.refreshToken ?? null)
      setUser(normalizeUser(data.user))
    }
    return {}
  }

  async function signUp(email: string, password: string, name: string) {
    const redirectTo = new URL('/sign-in', getAppOrigin()).toString()
    const { data, error } = await insforge.auth.signUp({
      email,
      password,
      name,
      redirectTo
    })
    if (error) return { error: error.message }
    if (data?.requireEmailVerification) {
      return { requireVerification: true }
    }
    if (data?.user) {
      persistTokens(data.accessToken ?? null, data.refreshToken ?? null)
      setUser(normalizeUser(data.user))
    }
    return {}
  }

  async function verifyEmail(email: string, code: string) {
    const { data, error } = await insforge.auth.verifyEmail({ email, otp: code })
    if (error) return { error: error.message }
    if (data?.user) {
      persistTokens(data.accessToken ?? null, data.refreshToken ?? null)
      setUser(normalizeUser(data.user))
    }
    return {}
  }

  async function refreshUser() {
    await checkUser()
  }

  async function updateProfile(profile: Record<string, unknown>) {
    const { error } = await insforge.auth.setProfile(profile)
    if (error) return { error: error.message }
    await checkUser()
    return {}
  }

  async function signOut() {
    await insforge.auth.signOut()
    clearTokenCookies()
    setUser(null)
  }

  return (
    <UserContext.Provider
      value={{ user, loading, signIn, signUp, signOut, verifyEmail, refreshUser, updateProfile }}
    >
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (!context) throw new Error('useUser must be used within UserProvider')
  return context
}
