'use client'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import { API, errorMessage } from '../api'

type Order = {
  id: number
  reference: string
  table_name: string
  status: string
  total: number
  customer_name: string
  customer_phone: string
  notes: string | null
  items: { name: string; quantity: number }[]
}

// Button shown for each status to move the order forward.
const NEXT_STEP: Record<string, { status: string; label: string }> = {
  PLACED: { status: 'ACCEPTED', label: 'Accept' },
  ACCEPTED: { status: 'PREPARING', label: 'Start preparing' },
  PREPARING: { status: 'READY', label: 'Mark ready' },
  READY: { status: 'COMPLETED', label: 'Complete' },
}
const CANCELLABLE = ['PLACED', 'ACCEPTED']
const REFRESH_MS = 15000

export default function Admin() {
  const [token, setToken] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [err, setErr] = useState('')

  /** Fetch an admin endpoint. A 401 (expired/invalid token) signs the admin out. */
  const adminFetch = useCallback(
    async (path: string, init: RequestInit = {}, authToken = token) => {
      const r = await fetch(`${API}${path}`, {
        ...init,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${authToken}`, ...init.headers },
      })
      if (r.status === 401) {
        setToken('')
        setErr('Your login has expired. Please sign in again.')
      }
      return r
    },
    [token],
  )

  const load = useCallback(
    async (authToken = token) => {
      const r = await adminFetch('/api/admin/orders', {}, authToken)
      if (r.ok) setOrders(await r.json())
    },
    [adminFetch, token],
  )

  // Poll so new orders show up without reloading the page.
  useEffect(() => {
    if (!token) return
    const timer = setInterval(() => load(), REFRESH_MS)
    return () => clearInterval(timer)
  }, [token, load])

  async function login(e: FormEvent) {
    e.preventDefault()
    setErr('')
    const r = await fetch(`${API}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!r.ok) return setErr(await errorMessage(r, 'Invalid email or password'))
    const d = await r.json()
    setPassword('')
    setToken(d.access_token)
    load(d.access_token)
  }

  async function move(order: Order, status: string) {
    if (status === 'CANCELLED' && !window.confirm(`Cancel order #${order.reference}?`)) return
    const r = await adminFetch(`/api/admin/orders/${order.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
    if (!r.ok && r.status !== 401) setErr(await errorMessage(r, 'Could not update the order'))
    load()
  }

  if (!token)
    return (
      <main className="shell">
        <form className="panel login" onSubmit={login}>
          <div className="brand">
            cafe<span>flow</span>
          </div>
          <h1>Welcome back</h1>
          <p>Sign in to manage today’s service.</p>
          <label>Email</label>
          <input
            className="input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label>Password</label>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {err && <div className="error">{err}</div>}
          <button className="primary" style={{ width: '100%' }}>
            Open dashboard
          </button>
        </form>
      </main>
    )

  const active = orders.filter((o) => !['COMPLETED', 'CANCELLED'].includes(o.status))
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <main className="shell">
      <div className="topbar">
        <div className="brand">
          cafe<span>flow</span>
        </div>
        <div className="actions" style={{ marginTop: 0 }}>
          <button className="pill" onClick={() => load()}>
            Refresh
          </button>
          <button className="pill" onClick={() => setToken('')}>
            Sign out
          </button>
        </div>
      </div>
      <div className="hero">
        <p>{today}</p>
        <h1>Keep the good stuff moving.</h1>
        <p>Your service view, in one place.</p>
      </div>
      <div className="admin-grid">
        <div className="stat">
          <span>New orders</span>
          <b>{orders.filter((o) => o.status === 'PLACED').length}</b>
        </div>
        <div className="stat">
          <span>Active</span>
          <b>{active.length}</b>
        </div>
        <div className="stat">
          <span>Completed</span>
          <b>{orders.filter((o) => o.status === 'COMPLETED').length}</b>
        </div>
      </div>
      <div className="panel">
        <h2>Today’s orders</h2>
        {err && <div className="error">{err}</div>}
        {orders.length === 0 ? (
          <p>No orders yet. New table orders will appear here.</p>
        ) : (
          orders.map((o) => (
            <div className="order" key={o.id}>
              <div>
                <span className="status">{o.status}</span>
                <h3>
                  #{o.reference} · {o.table_name}
                </h3>
                <div className="muted">
                  {o.customer_name} · {o.customer_phone}
                </div>
                {o.notes && <div className="muted">Note: {o.notes}</div>}
                {o.items.map((i) => (
                  <div key={i.name}>
                    {i.name} × {i.quantity}
                  </div>
                ))}
                <strong>₹{o.total}</strong>
              </div>
              <div className="actions">
                {NEXT_STEP[o.status] && (
                  <button onClick={() => move(o, NEXT_STEP[o.status].status)}>{NEXT_STEP[o.status].label}</button>
                )}
                {CANCELLABLE.includes(o.status) && <button onClick={() => move(o, 'CANCELLED')}>Cancel</button>}
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  )
}
