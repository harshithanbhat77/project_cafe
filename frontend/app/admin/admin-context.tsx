'use client'
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { API, errorMessage } from '@/lib/api'
import { useBrandAccent } from '@/lib/brand'
import type { Brand, Restaurant, User } from './types'

const TOKEN_KEY = 'cafeflow-admin-token'

type CallOptions = { method?: string; body?: unknown }

type AdminContextValue = {
  /** undefined while we check sessionStorage on first load */
  token: string | null | undefined
  me: User | null
  isOwner: boolean
  notice: string
  /** Name, logo and colors; available before sign-in. */
  brand: Brand | null
  /** Full settings, including bill rates; loaded after sign-in. */
  restaurant: Restaurant | null
  reloadRestaurant: () => Promise<void>
  login: (email: string, password: string) => Promise<string | null>
  logout: (notice?: string) => void
  /** Call an admin endpoint. Throws an Error with a readable message if it fails. */
  call: <T>(path: string, options?: CallOptions) => Promise<T>
  /** Upload an image (owner only). Returns its URL. */
  upload: (file: File) => Promise<string>
}

const AdminContext = createContext<AdminContextValue | null>(null)

export function AdminProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>()
  const [me, setMe] = useState<User | null>(null)
  const [notice, setNotice] = useState('')
  const [brand, setBrand] = useState<Brand | null>(null)
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)

  // Kept in sessionStorage so a page refresh doesn't sign you out; it's cleared when the tab closes.
  useEffect(() => setToken(sessionStorage.getItem(TOKEN_KEY)), [])

  useEffect(() => {
    fetch(`${API}/api/public/brand`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setBrand)
      .catch(() => {})
  }, [])

  const current = restaurant ?? brand
  useBrandAccent(current ? current.accent_color : undefined)
  useEffect(() => {
    if (current) document.title = `${current.name} · Dashboard`
  }, [current])

  const logout = useCallback((message = '') => {
    sessionStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setMe(null)
    setRestaurant(null)
    setNotice(message)
  }, [])

  const send = useCallback(
    async (path: string, init: RequestInit): Promise<Response> => {
      const r = await fetch(`${API}${path}`, {
        ...init,
        headers: { ...init.headers, authorization: `Bearer ${token}` },
      })
      if (r.status === 401) {
        // Expired token, or the account was deactivated.
        const message = "You've been signed out. Please sign in again."
        logout(message)
        throw new Error(message)
      }
      if (!r.ok) throw new Error(await errorMessage(r, 'Something went wrong. Please try again.'))
      return r
    },
    [token, logout],
  )

  const call = useCallback(
    async <T,>(path: string, options: CallOptions = {}): Promise<T> => {
      const r = await send(path, {
        method: options.method || 'GET',
        headers: { 'content-type': 'application/json' },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      })
      return r.status === 204 ? (undefined as T) : r.json()
    },
    [send],
  )

  const upload = useCallback(
    async (file: File): Promise<string> => {
      const form = new FormData()
      form.append('file', file)
      const r = await send('/api/admin/uploads', { method: 'POST', body: form })
      return (await r.json()).url
    },
    [send],
  )

  const reloadRestaurant = useCallback(async () => {
    const settings = await call<Restaurant>('/api/admin/settings')
    setRestaurant(settings)
    setBrand(settings)
  }, [call])

  useEffect(() => {
    if (!token) return
    call<User>('/api/admin/me')
      .then(setMe)
      .catch((e: Error) => logout(e.message))
    reloadRestaurant().catch(() => {})
  }, [token, call, logout, reloadRestaurant])

  async function login(email: string, password: string): Promise<string | null> {
    try {
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
    } catch {
      return 'Could not reach the server. Check your connection and try again.'
    }
  }

  const value = {
    token,
    me,
    isOwner: me?.role === 'OWNER',
    notice,
    brand,
    restaurant,
    reloadRestaurant,
    login,
    logout,
    call,
    upload,
  }
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}

export function useAdmin() {
  const value = useContext(AdminContext)
  if (!value) throw new Error('useAdmin must be used inside <AdminProvider>')
  return value
}
