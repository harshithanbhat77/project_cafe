'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { API, errorMessage } from '../../api'
import CartPanel from './CartPanel'
import JoinForm from './JoinForm'
import MenuView from './MenuView'
import MyOrders from './MyOrders'
import type { Cart, Menu, Order } from './types'

const POLL_MS = 10000

/** The guest page: holds the state and talks to the API. The other files in this folder just render. */
export default function OrderPage({ params }: { params: { token: string } }) {
  const tableUrl = `${API}/api/public/tables/${encodeURIComponent(params.token)}`
  const sessionKey = `cafeflow:${params.token}`
  const nameKey = `cafeflow-name:${params.token}`

  const [menu, setMenu] = useState<Menu>()
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [session, setSession] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [view, setView] = useState<'menu' | 'orders'>('menu')
  const [cart, setCart] = useState<Cart>({})
  const [notes, setNotes] = useState('')
  const [showCart, setShowCart] = useState(false)
  const [busy, setBusy] = useState(false)
  // One idempotency key per cart: a double tap or network retry sends the same key,
  // so the server returns the existing order instead of creating a duplicate.
  const orderKey = useRef<string | null>(null)
  const submitting = useRef(false)

  useEffect(() => {
    fetch(tableUrl)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Menu) => {
        setMenu(d)
        const saved = sessionStorage.getItem(sessionKey)
        if (saved) {
          setSession(saved)
          setName(sessionStorage.getItem(nameKey) || '')
        }
      })
      .catch(() => setLoadError('This table link is no longer active.'))
  }, [tableUrl, sessionKey, nameKey])

  const endSession = useCallback(
    (message: string) => {
      sessionStorage.removeItem(sessionKey)
      sessionStorage.removeItem(nameKey)
      setSession('')
      setOrders([])
      setView('menu')
      setShowCart(false)
      setError(message)
    },
    [sessionKey, nameKey],
  )

  const loadOrders = useCallback(async () => {
    try {
      const r = await fetch(`${tableUrl}/orders`, { headers: { 'x-session-token': session } })
      if (r.ok) setOrders(await r.json())
      // Staff cleared the table, or the session expired.
      else if (r.status === 401) endSession(await errorMessage(r, 'Your session has ended. Please enter your details again.'))
    } catch {
      // Offline for a moment: keep showing the last known status and try again on the next poll.
    }
  }, [tableUrl, session, endSession])

  // Load orders once when the session starts, and keep them fresh while the guest is watching them.
  useEffect(() => {
    if (!session) return
    loadOrders()
    if (view !== 'orders') return
    const timer = setInterval(loadOrders, POLL_MS)
    return () => clearInterval(timer)
  }, [session, view, loadOrders])

  function changeCart(id: number, delta: number) {
    orderKey.current = null // a different cart is a different order
    setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] || 0) + delta) }))
  }

  function changeNotes(value: string) {
    orderKey.current = null
    setNotes(value)
  }

  async function startSession(guestName: string, phone: string) {
    setBusy(true)
    setError('')
    try {
      const r = await fetch(`${tableUrl}/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: guestName, phone }),
      })
      if (r.ok) {
        const d = await r.json()
        setSession(d.session_token)
        setName(guestName.trim())
        sessionStorage.setItem(sessionKey, d.session_token)
        sessionStorage.setItem(nameKey, guestName.trim())
      } else {
        setError(await errorMessage(r, 'Please enter a valid name and phone number.'))
      }
    } catch {
      setError('Could not reach the cafe. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function checkout() {
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    setError('')
    orderKey.current ??= crypto.randomUUID()
    const lines = Object.entries(cart)
      .filter(([, q]) => q > 0)
      .map(([item_id, quantity]) => ({ item_id: Number(item_id), quantity }))
    try {
      const r = await fetch(`${tableUrl}/orders`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-session-token': session },
        body: JSON.stringify({ items: lines, notes, idempotency_key: orderKey.current }),
      })
      if (r.ok) {
        const order: Order = await r.json()
        // A retried request returns the same order, so don't list it twice.
        setOrders((list) => [order].concat(list.filter((o) => o.id !== order.id)))
        setCart({})
        setNotes('')
        setShowCart(false)
        setView('orders')
        orderKey.current = null
      } else if (r.status === 401) {
        endSession(await errorMessage(r, 'Your session has ended. Please enter your details again.'))
      } else {
        setError(await errorMessage(r, 'Something went wrong. Please try again.'))
      }
    } catch {
      setError('Could not reach the cafe. Check your connection and try again.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  if (loadError)
    return (
      <main className="shell">
        <div className="panel">
          <h1>Sorry, we can&apos;t open this table</h1>
          <p>{loadError}</p>
        </div>
      </main>
    )
  if (!menu)
    return (
      <main className="shell">
        <p>Loading menu...</p>
      </main>
    )

  return (
    <main className="shell">
      <div className="topbar">
        <div className="brand">
          cafe<span>flow</span>
        </div>
        <div className="topbar-pills">
          {session && view === 'menu' && orders.length > 0 && (
            <button className="pill" onClick={() => setView('orders')}>
              Your orders ({orders.length})
            </button>
          )}
          <span className="pill">{menu.table.name} · Dine in</span>
        </div>
      </div>

      {!session ? (
        <JoinForm busy={busy} error={error} onJoin={startSession} />
      ) : view === 'orders' ? (
        <MyOrders orders={orders} taxLabel={menu.charges.tax_label} onOrderMore={() => setView('menu')} />
      ) : (
        <>
          <MenuView
            menu={menu}
            name={name}
            cart={cart}
            error={showCart ? '' : error}
            onAdd={(id) => changeCart(id, 1)}
          />
          <CartPanel
            menu={menu}
            cart={cart}
            notes={notes}
            open={showCart}
            busy={busy}
            error={error}
            onOpen={() => setShowCart(true)}
            onClose={() => setShowCart(false)}
            onChange={changeCart}
            onNotes={changeNotes}
            onCheckout={checkout}
          />
        </>
      )}
    </main>
  )
}
