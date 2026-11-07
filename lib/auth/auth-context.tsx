'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export interface AuthUser {
  id: number
  username: string
  email: string | null
  role: string
  created_at?: string
}

export interface AuthContextValue {
  user: AuthUser | null
  role: string | null
  loading: boolean
  authenticated: boolean
  /** Re-fetch the server session (cookie based). Returns the current user or null. */
  refresh: () => Promise<AuthUser | null>
  /** Destroy the server session and clear local user state. */
  logout: () => Promise<void>
}

const defaultAuthContext: AuthContextValue = {
  user: null,
  role: null,
  loading: false,
  authenticated: false,
  refresh: async () => null,
  logout: async () => {},
}

export const AuthContext = createContext<AuthContextValue>(defaultAuthContext)

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}

async function fetchSessionUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch('/api/auth', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    })
    if (res.status === 401) return null
    const data = await res.json()
    if (data?.success && data.user && typeof data.user.id === 'number') {
      return data.user as AuthUser
    }
    return null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async (): Promise<AuthUser | null> => {
    const nextUser = await fetchSessionUser()
    setUser(nextUser)
    return nextUser
  }, [])

  const logout = useCallback(async (): Promise<void> => {
    try {
      let res = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      })
      // 兼容当前后端：登出由 POST /api/auth {action:'logout'} 处理。
      if (res.status === 404) {
        res = await fetch('/api/auth', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'logout' }),
        })
      }
    } catch {
      // 网络失败时仍需清理本地状态，服务端会话会在过期后失效。
    } finally {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    let active = true
    refresh().finally(() => {
      if (active) setLoading(false)
    })
    return () => {
      active = false
    }
  }, [refresh])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: user?.role ?? null,
      loading,
      authenticated: Boolean(user),
      refresh,
      logout,
    }),
    [user, loading, refresh, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
