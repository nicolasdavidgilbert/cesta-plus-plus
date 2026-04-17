'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
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

function getAppOrigin() {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin
  }

  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  function normalizeUser(raw: unknown): User {
    const userData = raw as User
    const profileName = userData.profile?.name
    return {
      ...userData,
      name: typeof profileName === 'string' && profileName.trim() ? profileName.trim() : userData.name,
    }
  }

  const checkUser = useCallback(async () => {
    const { data, error } = await insforge.auth.getCurrentUser()

    if (!error && data?.user) {
      setUser(normalizeUser(data.user))
    } else {
      setUser(null)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void checkUser()
    })
  }, [checkUser])

  async function signIn(email: string, password: string) {
    const { data, error } = await insforge.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    if (data?.user) {
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
      setUser(normalizeUser(data.user))
    }
    return {}
  }

  async function verifyEmail(email: string, code: string) {
    const { data, error } = await insforge.auth.verifyEmail({ email, otp: code })
    if (error) return { error: error.message }
    if (data?.user) {
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
