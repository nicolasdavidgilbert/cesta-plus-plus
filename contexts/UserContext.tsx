'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { insforge } from '@/lib/insforge'

type User = {
  id: string
  email: string
  name?: string
}

type UserContextType = {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string, name: string) => Promise<{ error?: string; requireVerification?: boolean }>
  signOut: () => Promise<void>
  verifyEmail: (email: string, code: string) => Promise<{ error?: string }>
}

const UserContext = createContext<UserContextType | null>(null)

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const checkUser = useCallback(async () => {
    const { data, error } = await insforge.auth.getCurrentUser()

    if (!error && data?.user) {
      setUser(data.user as User)
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
      setUser(data.user as User)
    }
    return {}
  }

  async function signUp(email: string, password: string, name: string) {
    const { data, error } = await insforge.auth.signUp({
      email,
      password,
      name,
      redirectTo: '/sign-in'
    })
    if (error) return { error: error.message }
    if (data?.requireEmailVerification) {
      return { requireVerification: true }
    }
    if (data?.user) {
      setUser(data.user as User)
    }
    return {}
  }

  async function verifyEmail(email: string, code: string) {
    const { data, error } = await insforge.auth.verifyEmail({ email, otp: code })
    if (error) return { error: error.message }
    if (data?.user) {
      setUser(data.user as User)
    }
    return {}
  }

  async function signOut() {
    await insforge.auth.signOut()
    setUser(null)
  }

  return (
    <UserContext.Provider value={{ user, loading, signIn, signUp, signOut, verifyEmail }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (!context) throw new Error('useUser must be used within UserProvider')
  return context
}
