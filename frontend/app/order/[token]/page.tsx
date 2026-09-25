'use client'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { API, errorMessage } from '../../api'

type Item = { id: number; name: string; description: string; price: number; image_url?: string; available: boolean }
type Category = { id: number; name: string; items: Item[] }
type Menu = { table: { name: string }; categories: Category[] }
type OrderLine = { name: string; quantity: number; line_total: number }
type Order = { reference: string; total: number; items: OrderLine[] }
type Cart = Record<number, number>

export default function OrderPage({ params }: { params: { token: string } }) {
  const tableUrl = `${API}/api/public/tables/${encodeURIComponent(params.token)}`
  const sessionKey = `cafeflow:${params.token}`
  const nameKey = `cafeflow-name:${params.token}`

  const [menu, setMenu] = useState<Menu>()
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [session, setSession] = useState('')
  const [cart, setCart] = useState<Cart>({})
  const [showCart, setShowCart] = useState(false)
  const [busy, setBusy] = useState(false)
  const [placed, setPlaced] = useState<Order>()
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

  function endSession(message: string) {
    sessionStorage.removeItem(sessionKey)
    sessionStorage.removeItem(nameKey)
    setSession('')
    setShowCart(false)
    setError(message)
  }

  function changeCart(id: number, delta: number) {
    orderKey.current = null // a different cart is a different order
    setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] || 0) + delta) }))
  }

  async function startSession(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const r = await fetch(`${tableUrl}/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, phone }),
    })
    if (r.ok) {
      const d = await r.json()
      setSession(d.session_token)
      sessionStorage.setItem(sessionKey, d.session_token)
      sessionStorage.setItem(nameKey, name.trim())
    } else {
      setError(await errorMessage(r, 'Please enter a valid name and phone number.'))
    }
    setBusy(false)
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
        body: JSON.stringify({ items: lines, idempotency_key: orderKey.current }),
      })
      if (r.ok) {
        setPlaced(await r.json())
        setCart({})
        setShowCart(false)
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

  const items = menu.categories.flatMap((c) => c.items)
  const count = Object.values(cart).reduce((a, b) => a + b, 0)
  const subtotal = items.reduce((s, i) => s + i.price * (cart[i.id] || 0), 0)
  const topbar = (
    <div className="topbar">
      <div className="brand">
        cafe<span>flow</span>
      </div>
      <span className="pill">{menu.table.name} · Dine in</span>
    </div>
  )

  if (placed)
    return (
      <main className="shell">
        {topbar}
        <div className="hero">
          <p>Your order is in</p>
          <h1>Thank you - we&apos;re on it.</h1>
          <p>
            Order <b>#{placed.reference}</b> has been sent to the cafe.
          </p>
        </div>
        <div className="panel">
          <h2>Order summary</h2>
          {placed.items.map((i) => (
            <p key={i.name}>
              {i.name} x {i.quantity}
              <strong style={{ float: 'right' }}>₹{i.line_total}</strong>
            </p>
          ))}
          <hr />
          <p>
            <strong>Total</strong>
            <strong style={{ float: 'right' }}>₹{placed.total}</strong>
          </p>
          <button className="primary" onClick={() => setPlaced(undefined)}>
            Back to menu
          </button>
        </div>
      </main>
    )

  if (!session)
    return (
      <main className="shell">
        {topbar}
        <div className="hero">
          <p>Welcome to CafeFlow</p>
          <h1>What should we call you?</h1>
          <p>We&apos;ll use this to bring your order to the right table. No password or OTP needed.</p>
        </div>
        <form className="panel" onSubmit={startSession}>
          <label>Your name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Aanya Sharma"
            required
            minLength={2}
            maxLength={100}
          />
          <label>Phone number</label>
          <input
            className="input"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. +91 98765 43210"
            required
            minLength={7}
            maxLength={32}
          />
          {error && <div className="error">{error}</div>}
          <button className="primary" disabled={busy}>
            {busy ? 'Opening menu...' : 'Continue to menu'}
          </button>
        </form>
      </main>
    )

  return (
    <main className="shell">
      {topbar}
      <section className="hero">
        <p>Good food, good company</p>
        <h1>Take a little time for something delicious.</h1>
        <p>Hi {name || 'there'} - order from your table and we&apos;ll bring it right over.</p>
      </section>
      {error && !showCart && <div className="error">{error}</div>}
      {menu.categories.map((c) => (
        <section key={c.id}>
          <h2 className="category">{c.name}</h2>
          <div className="menu-grid">
            {c.items.map((i) => (
              <article className={i.available ? 'card' : 'card sold-out'} key={i.id}>
                {i.image_url && <img src={i.image_url} alt="" />}
                <div className="card-body">
                  <h3>{i.name}</h3>
                  <div className="description">{i.description}</div>
                  <div className="price-row">
                    <span className="price">₹{i.price}</span>
                    <button className="add" disabled={!i.available} onClick={() => changeCart(i.id, 1)}>
                      {!i.available ? 'Sold out' : `Add ${cart[i.id] ? `· ${cart[i.id]}` : ''}`}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
      {count > 0 && (
        <button className="cart" onClick={() => setShowCart(true)}>
          View order · {count} items · ₹{subtotal}
        </button>
      )}
      {showCart && (
        <aside className="cart-panel">
          <div className="topbar">
            <h2 style={{ margin: 0 }}>Your order</h2>
            <button className="pill" onClick={() => setShowCart(false)}>
              Close
            </button>
          </div>
          {items
            .filter((i) => cart[i.id])
            .map((i) => (
              <div className="cart-line" key={i.id}>
                <div>
                  <strong>{i.name}</strong>
                  <div>₹{i.price} each</div>
                </div>
                <div className="quantity">
                  <button onClick={() => changeCart(i.id, -1)}>-</button>
                  <strong>{cart[i.id]}</strong>
                  <button onClick={() => changeCart(i.id, 1)}>+</button>
                </div>
              </div>
            ))}
          <p>
            <strong>Total</strong>
            <strong style={{ float: 'right' }}>₹{subtotal}</strong>
          </p>
          {error && <div className="error">{error}</div>}
          <div className="cart-actions">
            <button className="primary" onClick={checkout} disabled={busy || count === 0}>
              {busy ? 'Placing order...' : 'Place order'}
            </button>
          </div>
        </aside>
      )}
    </main>
  )
}
