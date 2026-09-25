'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { money } from '../api'
import { useAdmin } from './admin-context'
import type { Order, OrderStatus, Summary } from './types'

const POLL_MS = 5000

// Button shown for each status to move the order forward.
const NEXT_STEP: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  PLACED: { status: 'ACCEPTED', label: 'Accept' },
  ACCEPTED: { status: 'PREPARING', label: 'Start preparing' },
  PREPARING: { status: 'READY', label: 'Mark ready' },
  READY: { status: 'COMPLETED', label: 'Complete' },
}
const CANCELLABLE: OrderStatus[] = ['PLACED', 'ACCEPTED']
const FINISHED: OrderStatus[] = ['COMPLETED', 'CANCELLED']

export default function OrdersPage() {
  const { call, isOwner } = useAdmin()
  const [orders, setOrders] = useState<Order[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState('')
  // New orders stay highlighted until someone acts on them.
  const [highlighted, setHighlighted] = useState<number[]>([])
  const seenIds = useRef<number[] | null>(null)
  const audio = useRef<AudioContext | null>(null)
  const [soundOn, setSoundOn] = useState(false)

  const load = useCallback(async () => {
    try {
      const list = await call<Order[]>('/api/admin/orders')
      // On the first load everything is "already seen", so there's no chime for old orders.
      const seen = seenIds.current
      const newOrders = seen ? list.filter((o) => o.status === 'PLACED' && !seen.includes(o.id)) : []
      seenIds.current = list.map((o) => o.id)
      if (newOrders.length > 0) {
        setHighlighted((ids) => ids.concat(newOrders.map((o) => o.id)))
        if (audio.current) chime(audio.current)
      }
      setOrders(list)
      if (isOwner) setSummary(await call<Summary>('/api/admin/summary'))
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }, [call, isOwner])

  useEffect(() => {
    load()
    const timer = setInterval(load, POLL_MS)
    return () => clearInterval(timer)
  }, [load])

  function enableSound() {
    // Browsers only allow audio after the user clicks something, hence the button.
    audio.current = new AudioContext()
    setSoundOn(true)
    chime(audio.current)
  }

  async function move(order: Order, status: OrderStatus) {
    if (status === 'CANCELLED' && !window.confirm(`Cancel order #${order.reference}?`)) return
    setHighlighted((ids) => ids.filter((id) => id !== order.id))
    try {
      await call(`/api/admin/orders/${order.id}/status`, { method: 'PATCH', body: { status } })
    } catch (e) {
      setError((e as Error).message)
    }
    load()
  }

  const active = orders.filter((o) => !FINISHED.includes(o.status))
  const finished = orders.filter((o) => FINISHED.includes(o.status))
  const waiting = orders.filter((o) => o.status === 'PLACED').length
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <>
      <div className="hero">
        <p>{today}</p>
        <h1>Keep the good stuff moving.</h1>
        <p>New orders appear here automatically.</p>
      </div>

      {!soundOn && (
        <button className="pill no-print" onClick={enableSound} style={{ marginBottom: 14 }}>
          🔔 Turn on sound for new orders
        </button>
      )}

      <div className="admin-grid">
        <div className="stat">
          <span>Waiting to accept</span>
          <b>{waiting}</b>
        </div>
        {isOwner && summary ? (
          <>
            <div className="stat">
              <span>Orders today</span>
              <b>{summary.orders}</b>
            </div>
            <div className="stat">
              <span>Revenue today</span>
              <b>{money(summary.revenue)}</b>
            </div>
          </>
        ) : (
          <>
            <div className="stat">
              <span>In progress</span>
              <b>{active.length - waiting}</b>
            </div>
            <div className="stat">
              <span>Completed</span>
              <b>{orders.filter((o) => o.status === 'COMPLETED').length}</b>
            </div>
          </>
        )}
      </div>
      {isOwner && summary && summary.top_items.length > 0 && (
        <p className="muted">
          Best sellers today: {summary.top_items.map((i) => `${i.name} × ${i.quantity}`).join(', ')}
        </p>
      )}

      <div className="panel">
        <h2>Active orders</h2>
        {error && <div className="error">{error}</div>}
        {active.length === 0 ? (
          <p>No active orders. New table orders will appear here.</p>
        ) : (
          active.map((o) => (
            <OrderCard key={o.id} order={o} isNew={highlighted.includes(o.id)} onMove={(status) => move(o, status)} />
          ))
        )}
      </div>

      {finished.length > 0 && (
        <details className="panel">
          <summary>
            <strong>Finished ({finished.length})</strong>
          </summary>
          {finished.map((o) => (
            <OrderCard key={o.id} order={o} isNew={false} onMove={() => {}} />
          ))}
        </details>
      )}
    </>
  )
}

function OrderCard({ order, isNew, onMove }: { order: Order; isNew: boolean; onMove: (status: OrderStatus) => void }) {
  const next = NEXT_STEP[order.status]
  const time = new Date(order.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  return (
    <div className={isNew ? 'order new-order' : 'order'}>
      <div>
        <span className="status">{order.status}</span> <span className="muted">{time}</span>
        <h3>
          #{order.reference} · {order.table_name}
        </h3>
        <div className="muted">
          {order.customer_name} · {order.customer_phone}
        </div>
        {order.notes && <div className="order-note">Note: {order.notes}</div>}
        {order.items.map((i) => (
          <div key={i.name}>
            {i.name} × {i.quantity}
          </div>
        ))}
        <strong>{money(order.total)}</strong>
        {order.service_charge + order.tax > 0 && (
          <span className="muted"> (incl. {money(order.service_charge + order.tax)} service & tax)</span>
        )}
      </div>
      <div className="actions">
        {next && <button onClick={() => onMove(next.status)}>{next.label}</button>}
        {CANCELLABLE.includes(order.status) && <button onClick={() => onMove('CANCELLED')}>Cancel</button>}
      </div>
    </div>
  )
}

/** Two short rising beeps, made with the Web Audio API (no sound file needed). */
function chime(ctx: AudioContext) {
  ;[880, 1320].forEach((frequency, i) => {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.frequency.value = frequency
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    const start = ctx.currentTime + i * 0.18
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3)
    oscillator.start(start)
    oscillator.stop(start + 0.32)
  })
}
