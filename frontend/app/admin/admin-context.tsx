'use client'
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { API, errorMessage } from '../api'
import type { User } from './types'

const TOKEN_KEY = 'cafeflow-admin-token'

type AdminContextValue = {
  /** undefined while we check sessionStorage on first load */
  token: string | null | undefined
  me: User | null
  isOwner: boolean
  notice: string
  login: (email: string, password: string) => Promise<string | null>
  logout: (notice?: string) => void
  /** Call an admin endpoint. Throws an Error with a readable message if it fails. */
  call: <T>(path: string, options?: { method?: string; body?: unknown }) => Promise<T>
}

const AdminContext = createContext<AdminContextValue | null>(null)

export function AdminProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>()
  const [me, setMe] = useState<User | null>(null)
  const [notice, setNotice] = useState('')

  // Kept in sessionStorage so a page refresh doesn't sign you out; it's cleared when the tab closes.
  useEffect(() => setToken(sessionStorage.getItem(TOKEN_KEY)), [])

  const logout = useCallback((message = '') => {
    sessionStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setMe(null)
    setNotice(message)
  }, [])

  const call = useCallback(
    async <T,>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> => {
      const r = await fetch(`${API}${path}`, {
        method: options.method || 'GET',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      })
      if (r.status === 401) {
        // Expired token, or the account was deactivated.
        const message = "You've been signed out. Please sign in again."
        logout(message)
        throw new Error(message)
      }
      if (!r.ok) throw new Error(await errorMessage(r, 'Something went wrong. Please try again.'))
      return r.json()
    },
    [token, logout],
  )

  useEffect(() => {
    if (token) call<User>('/api/admin/me').then(setMe).catch((e: Error) => logout(e.message))
  }, [token, call, logout])

  async function login(email: string, password: string): Promise<string | null> {
    const r = await fetch(`${API}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!r.ok) return errorMessage(r, 'Invalid email or password')
    const { access_token } = await r.json()
    sessionStorage.setItem(TOKEN_KEY, access_token)
    setNotice('')
    setToken(access_token)
    return null
  }

  const value = { token, me, isOwner: me?.role === 'OWNER', notice, login, logout, call }
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}

export function useAdmin() {
  const value = useContext(AdminContext)
  if (!value) throw new Error('useAdmin must be used inside <AdminProvider>')
  return value
}
