'use client'
import { use, useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, QrCode, ReceiptText } from 'lucide-react'
import { toast } from 'sonner'
import { BrandMark } from '@/components/brand-mark'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { API, errorMessage } from '@/lib/api'
import { useBrandAccent } from '@/lib/brand'
import CartPanel from './CartPanel'
import { type Guest, loadGuest, saveGuest } from './GuestDetails'
import HelpDrawer from './HelpDrawer'
import MenuView from './MenuView'
import MyOrders from './MyOrders'
import type { Cart, Menu, Order, ServiceRequest } from './types'

const POLL_MS = 10000
const OFFLINE = 'Could not reach the cafe. Check your connection and try again.'
const SESSION_ENDED = 'Your visit was ended by staff. Your cart is still here; check your details and order again.'

/** The guest page: holds the state and talks to the API. The other files in this folder just render.
 *
 * Guests browse the menu straight away. Their name and phone are asked for only when they
 * first order or call for staff; that creates the table session the API needs. */
export default function OrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const tableUrl = `${API}/api/public/tables/${encodeURIComponent(token)}`
  const sessionKey = `cafeflow:${token}`

  const [menu, setMenu] = useState<Menu>()
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [guest, setGuest] = useState<Guest>({ name: '', phone: '' })
  const [session, setSession] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [view, setView] = useState<'menu' | 'orders'>('menu')
  const [cart, setCart] = useState<Cart>({})
  const [notes, setNotes] = useState('')
  const [showCart, setShowCart] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [busy, setBusy] = useState(false)
  // One idempotency key per cart: a double tap or network retry sends the same key,
  // so the server returns the existing order instead of creating a duplicate.
  const orderKey = useRef<string | null>(null)
  const submitting = useRef(false)
  useBrandAccent(menu?.restaurant.accent_color)

  useEffect(() => {
    setGuest(loadGuest())
    fetch(tableUrl)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Menu) => {
        setMenu(d)
        document.title = `${d.restaurant.name} · ${d.table.name}`
        setSession(sessionStorage.getItem(sessionKey) || '')
      })
      .catch(() => setLoadError('This table link is no longer active.'))
  }, [tableUrl, sessionKey])

  const endSession = useCallback(
    (message: string) => {
      sessionStorage.removeItem(sessionKey)
      setSession('')
      setOrders([])
      setRequests([])
      setView('menu')
      toast.message(message)
    },
    [sessionKey],
  )

  /** GET a guest endpoint; ends the session on 401. Returns null if it failed. */
  const guestGet = useCallback(
    async <T,>(path: string): Promise<T | null> => {
      try {
        const r = await fetch(`${tableUrl}${path}`, { headers: { 'x-session-token': session } })
        if (r.ok) return r.json()
        // Staff cleared the table, or the session expired.
        if (r.status === 401) endSession(SESSION_ENDED)
      } catch {
        // Offline for a moment: keep showing the last known status and try again on the next poll.
      }
      return null
    },
    [tableUrl, session, endSession],
  )

  const refresh = useCallback(async () => {
    const [o, r] = await Promise.all([guestGet<Order[]>('/orders'), guestGet<ServiceRequest[]>('/requests')])
    if (o) setOrders(o)
    if (r) setRequests(r)
  }, [guestGet])

  // Load once when the session starts; keep fresh while the guest watches their orders
  // or waits for staff to answer a request.
  const watching = view === 'orders' || requests.length > 0
  useEffect(() => {
    if (!session) return
    refresh()
    if (!watching) return
    const timer = setInterval(refresh, POLL_MS)
    return () => clearInterval(timer)
  }, [session, watching, refresh])

  function changeCart(id: number, delta: number) {
    orderKey.current = null // a different cart is a different order
    setCart((c) => {
      const next = { ...c, [id]: Math.max(0, (c[id] || 0) + delta) }
      if (next[id] === 0) delete next[id]
      return next
    })
  }

  // Emptying the cart closes it, so it doesn't spring open again on the next "Add".
  const cartCount = Object.values(cart).reduce((n, q) => n + q, 0)
  useEffect(() => {
    if (cartCount === 0) setShowCart(false)
  }, [cartCount])

  function changeNotes(value: string) {
    orderKey.current = null
    setNotes(value)
  }

  /** The guest's session token, creating it from their name and phone if needed. */
  async function ensureSession(): Promise<{ token: string } | { error: string }> {
    if (session) return { token: session }
    try {
      const r = await fetch(`${tableUrl}/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: guest.name, phone: guest.phone }),
      })
      if (!r.ok) return { error: await errorMessage(r, 'Please enter your name and a valid phone number.') }
      const { session_token } = await r.json()
      sessionStorage.setItem(sessionKey, session_token)
      saveGuest({ name: guest.name.trim(), phone: guest.phone.trim() })
      setSession(session_token)
      return { token: session_token }
    } catch {
      return { error: OFFLINE }
    }
  }

  async function checkout() {
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      const started = await ensureSession()
      if ('error' in started) return setError(started.error)
      const sessionToken = started.token
      orderKey.current ??= crypto.randomUUID()
      const lines = Object.entries(cart)
        .filter(([, q]) => q > 0)
        .map(([item_id, quantity]) => ({ item_id: Number(item_id), quantity }))
      const r = await fetch(`${tableUrl}/orders`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-session-token': sessionToken },
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
        window.scrollTo({ top: 0 })
        orderKey.current = null
        toast.success('Order sent to the kitchen', { description: `Order #${order.reference}` })
      } else if (r.status === 401) {
        endSession(SESSION_ENDED)
      } else {
        setError(await errorMessage(r, 'Something went wrong. Please try again.'))
      }
    } catch {
      setError(OFFLINE)
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  async function requestHelp(kind: ServiceRequest['kind']): Promise<boolean> {
    const started = await ensureSession()
    if ('error' in started) {
      toast.error(started.error)
      return false
    }
    const sessionToken = started.token
    try {
      const r = await fetch(`${tableUrl}/requests`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-session-token': sessionToken },
        body: JSON.stringify({ kind }),
      })
      if (r.ok) {
        const request: ServiceRequest = await r.json()
        setRequests((list) => list.filter((x) => x.id !== request.id).concat(request))
        toast.success(kind === 'BILL' ? 'Your bill is on the way' : 'A waiter is on the way')
        return true
      }
      if (r.status === 401) endSession(SESSION_ENDED)
      else toast.error(await errorMessage(r, 'Something went wrong. Please try again.'))
    } catch {
      toast.error(OFFLINE)
    }
    return false
  }

  if (loadError) return <TableUnavailable />
  if (!menu) return <MenuSkeleton />

  const helpPending = requests.length > 0

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="relative px-4 pt-7 pb-5 text-center">
        {view === 'orders' && (
          <Button variant="ghost" size="icon-lg" onClick={() => setView('menu')} aria-label="Back to the menu" className="absolute top-5 left-3">
            <ChevronLeft className="size-5" />
          </Button>
        )}
        {view === 'menu' && orders.length > 0 && (
          <Button
            variant="outline"
            className="absolute top-5 right-3 h-9 rounded-full bg-card px-3 text-sm"
            onClick={() => setView('orders')}
          >
            <ReceiptText /> Orders
            <span className="rounded-full bg-primary px-1.5 text-xs leading-5 text-primary-foreground">{orders.length}</span>
          </Button>
        )}
        {menu.restaurant.logo_url && (
          <BrandMark name={menu.restaurant.name} logoUrl={menu.restaurant.logo_url} className="mx-auto mb-3 size-12 rounded-full" />
        )}
        <p className="text-[11px] font-medium tracking-[0.25em] text-muted-foreground uppercase">{menu.table.name}</p>
        <h1 className="mt-1 text-[2.1rem] leading-tight font-normal italic">{menu.restaurant.name}</h1>
      </header>

      {view === 'orders' ? (
        <MyOrders
          orders={orders}
          currency={menu.restaurant.currency}
          taxLabel={menu.charges.tax_label}
          onOrderMore={() => {
            setView('menu')
            window.scrollTo({ top: 0 })
          }}
          helpPending={helpPending}
          onHelp={() => setShowHelp(true)}
        />
      ) : (
        <>
          <MenuView
            menu={menu}
            name={session ? guest.name : ''}
            cart={cart}
            onChange={changeCart}
            helpPending={helpPending}
            onHelp={() => setShowHelp(true)}
          />
          <CartPanel
            menu={menu}
            cart={cart}
            notes={notes}
            needsDetails={!session}
            guest={guest}
            onGuest={setGuest}
            open={showCart}
            busy={busy}
            error={error}
            onOpen={() => {
              setError('')
              setShowCart(true)
            }}
            onClose={() => setShowCart(false)}
            onChange={changeCart}
            onNotes={changeNotes}
            onCheckout={checkout}
          />
        </>
      )}

      <HelpDrawer
        open={showHelp}
        onOpenChange={setShowHelp}
        requests={requests}
        needsDetails={!session}
        guest={guest}
        onGuest={setGuest}
        onRequest={requestHelp}
      />
    </div>
  )
}

function TableUnavailable() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-muted">
          <QrCode className="size-7 text-muted-foreground" />
        </span>
        <h1 className="text-xl font-semibold">This table link isn&apos;t active</h1>
        <p className="mt-2 text-muted-foreground">
          The QR code may have been replaced. Please scan the code on your table again, or ask a member of staff.
        </p>
      </div>
    </main>
  )
}

function MenuSkeleton() {
  return (
    <div className="min-h-dvh bg-background" aria-busy="true" aria-label="Loading the menu">
      <div className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
          <Skeleton className="size-10 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-5xl space-y-3 px-4 pt-6">
        <Skeleton className="h-11 w-full rounded-xl" />
        <div className="flex gap-2">
          {[80, 110, 70, 120].map((w) => (
            <Skeleton key={w} className="h-9 rounded-full" style={{ width: w }} />
          ))}
        </div>
        <div className="grid gap-3 pt-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
