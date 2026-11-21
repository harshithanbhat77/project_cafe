'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BellRing,
  Check,
  ChefHat,
  CircleCheck,
  ClipboardList,
  Clock,
  ReceiptText,
  StickyNote,
  TrendingUp,
  UserRound,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { money } from '@/lib/api'
import { clockTime, timeSince, useNow } from '@/lib/time'
import { cn } from '@/lib/utils'
import { useAdmin } from './admin-context'
import type { Order, OrderStatus, ServiceRequest, Summary } from './types'
import { EmptyState, ErrorBanner, PageHeader } from './ui'

const POLL_MS = 5000
const SOUND_KEY = 'cafeflow-sound'

const STATUS: Record<OrderStatus, { label: string; className: string }> = {
  PLACED: { label: 'New', className: 'bg-amber-100 text-amber-900' },
  ACCEPTED: { label: 'Accepted', className: 'bg-sky-100 text-sky-900' },
  PREPARING: { label: 'Preparing', className: 'bg-violet-100 text-violet-900' },
  READY: { label: 'Ready to serve', className: 'bg-green-100 text-green-900' },
  COMPLETED: { label: 'Served', className: 'bg-muted text-muted-foreground' },
  CANCELLED: { label: 'Cancelled', className: 'bg-red-100 text-red-800' },
}

// Button shown for each status to move the order forward.
const NEXT_STEP: Partial<Record<OrderStatus, { status: OrderStatus; label: string; icon: LucideIcon }>> = {
  PLACED: { status: 'ACCEPTED', label: 'Accept order', icon: Check },
  ACCEPTED: { status: 'PREPARING', label: 'Start preparing', icon: ChefHat },
  PREPARING: { status: 'READY', label: 'Mark ready', icon: BellRing },
  READY: { status: 'COMPLETED', label: 'Mark served', icon: CircleCheck },
}
const CANCELLABLE: OrderStatus[] = ['PLACED', 'ACCEPTED']

// Minutes since the guest ordered after which a card turns amber, then red, so slow orders stand out.
const LATE_AFTER: Partial<Record<OrderStatus, [number, number]>> = {
  PLACED: [3, 7], // nobody has accepted it yet
  ACCEPTED: [15, 25],
  PREPARING: [15, 25],
  READY: [15, 25],
}

function lateness(order: Order, now: number): 'on-time' | 'late' | 'very-late' {
  const limits = LATE_AFTER[order.status]
  if (!limits) return 'on-time'
  const minutes = (now - new Date(order.created_at).getTime()) / 60000
  return minutes >= limits[1] ? 'very-late' : minutes >= limits[0] ? 'late' : 'on-time'
}

const FILTERS = {
  active: { label: 'Active', statuses: ['PLACED', 'ACCEPTED', 'PREPARING', 'READY'] },
  new: { label: 'New', statuses: ['PLACED'] },
  kitchen: { label: 'In the kitchen', statuses: ['ACCEPTED', 'PREPARING'] },
  ready: { label: 'Ready', statuses: ['READY'] },
  done: { label: 'Finished', statuses: ['COMPLETED', 'CANCELLED'] },
} satisfies Record<string, { label: string; statuses: OrderStatus[] }>
type Filter = keyof typeof FILTERS

export default function OrdersPage() {
  const { call, isOwner, restaurant } = useAdmin()
  const currency = restaurant?.currency ?? 'INR'
  const now = useNow()
  const [confirm, confirmDialog] = useConfirm()
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('active')
  const [moving, setMoving] = useState<number | null>(null)
  // New orders stay highlighted until someone acts on them.
  const [highlighted, setHighlighted] = useState<number[]>([])
  const seenOrders = useRef<Set<number> | null>(null)
  const seenRequests = useRef<Set<number> | null>(null)
  const audio = useRef<AudioContext | null>(null)
  const [soundOn, setSoundOn] = useState(false)

  const load = useCallback(async () => {
    try {
      const [list, open] = await Promise.all([
        call<Order[]>('/api/admin/orders'),
        call<ServiceRequest[]>('/api/admin/requests'),
      ])
      // On the first load everything is "already seen", so there's no chime for old orders.
      const newOrders = seenOrders.current
        ? list.filter((o) => o.status === 'PLACED' && !seenOrders.current!.has(o.id))
        : []
      const newRequests = seenRequests.current ? open.filter((r) => !seenRequests.current!.has(r.id)) : []
      seenOrders.current = new Set(list.map((o) => o.id))
      seenRequests.current = new Set(open.map((r) => r.id))
      if (newOrders.length > 0) setHighlighted((ids) => ids.concat(newOrders.map((o) => o.id)))
      if ((newOrders.length > 0 || newRequests.length > 0) && audio.current) chime(audio.current)
      setOrders(list)
      setRequests(open)
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

  // Remember the sound choice. Browsers only allow audio after a click, so it's re-armed on the first click.
  useEffect(() => {
    if (localStorage.getItem(SOUND_KEY) !== 'on') return
    const arm = () => {
      audio.current ??= new AudioContext()
      setSoundOn(true)
    }
    window.addEventListener('pointerdown', arm, { once: true })
    return () => window.removeEventListener('pointerdown', arm)
  }, [])

  function toggleSound() {
    if (soundOn) {
      audio.current?.close()
      audio.current = null
      setSoundOn(false)
      localStorage.setItem(SOUND_KEY, 'off')
      return
    }
    audio.current = new AudioContext()
    setSoundOn(true)
    localStorage.setItem(SOUND_KEY, 'on')
    chime(audio.current)
  }

  async function move(order: Order, status: OrderStatus) {
    if (
      status === 'CANCELLED' &&
      !(await confirm({
        title: `Cancel order #${order.reference}?`,
        description: `${order.table_name} · ${order.customer_name}. The guest will see that it was cancelled. This can't be undone.`,
        confirmLabel: 'Cancel order',
        cancelLabel: 'Keep order',
        destructive: true,
      }))
    )
      return
    setHighlighted((ids) => ids.filter((id) => id !== order.id))
    setMoving(order.id)
    try {
      await call(`/api/admin/orders/${order.id}/status`, { method: 'PATCH', body: { status } })
      if (status === 'CANCELLED') toast(`Order #${order.reference} cancelled`)
    } catch (e) {
      toast.error((e as Error).message)
    }
    await load()
    setMoving(null)
  }

  async function resolve(request: ServiceRequest) {
    setRequests((list) => list.filter((r) => r.id !== request.id))
    try {
      await call(`/api/admin/requests/${request.id}/resolve`, { method: 'POST' })
    } catch (e) {
      toast.error((e as Error).message)
      load()
    }
  }

  const all = orders ?? []
  const count = (f: Filter) => all.filter((o) => (FILTERS[f].statuses as OrderStatus[]).includes(o.status)).length
  const shown = all
    .filter((o) => (FILTERS[filter].statuses as OrderStatus[]).includes(o.status))
    // Oldest first while orders are being worked on; newest first in the finished list.
    .sort((a, b) => (filter === 'done' ? -1 : 1) * a.created_at.localeCompare(b.created_at))
  const waiting = count('new')
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <>
      {confirmDialog}
      <PageHeader
        title="Orders"
        description={
          waiting > 0 ? (
            <span className="font-medium text-primary">
              {waiting} new {waiting === 1 ? 'order is' : 'orders are'} waiting to be accepted
            </span>
          ) : (
            `${today} · updates every few seconds`
          )
        }
        actions={
          <Button variant={soundOn ? 'secondary' : 'outline'} size="lg" onClick={toggleSound} aria-pressed={soundOn}>
            {soundOn ? <Volume2 /> : <VolumeX />}
            {soundOn ? 'Sound on' : 'Turn on sound'}
          </Button>
        }
      />
      <ErrorBanner message={error} />

      {requests.length > 0 && (
        <section aria-label="Guest requests" className="mb-6 space-y-2">
          {requests.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-xl border border-primary/30 bg-brand-soft p-3 pl-4 animate-in fade-in slide-in-from-top-1"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                {r.kind === 'BILL' ? <ReceiptText className="size-5" /> : <UserRound className="size-5" />}
              </span>
              <p className="min-w-0 flex-1 text-sm">
                <span className="font-semibold">{r.table_name}</span>{' '}
                {r.kind === 'BILL' ? 'would like the bill' : 'is asking for a waiter'}
                <span className="text-muted-foreground">
                  {' '}
                  · {r.customer_name} · {timeSince(r.created_at, now)}
                </span>
              </p>
              <Button size="lg" onClick={() => resolve(r)}>
                <Check /> Done
              </Button>
            </div>
          ))}
        </section>
      )}

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="mb-4">
        <TabsList className="h-auto w-full justify-start overflow-x-auto p-1 sm:w-fit">
          {(Object.keys(FILTERS) as Filter[]).map((f) => (
            <TabsTrigger key={f} value={f} className="h-8 flex-none px-3">
              {FILTERS[f].label}
              <span
                className={cn(
                  'ml-1 rounded-full px-1.5 text-xs tabular-nums',
                  f === 'new' && count(f) > 0 ? 'bg-primary text-primary-foreground' : 'bg-muted',
                )}
              >
                {count(f)}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {orders === null ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <EmptyState icon={ClipboardList} title={filter === 'done' ? 'No finished orders yet' : 'No orders here right now'}>
          New orders from the tables appear here automatically{soundOn ? ', with a chime' : ''}.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              currency={currency}
              now={now}
              isNew={highlighted.includes(o.id)}
              busy={moving === o.id}
              onMove={(status) => move(o, status)}
            />
          ))}
        </div>
      )}

      {isOwner && summary && (
        <section aria-label="Today" className="mt-10 rounded-2xl border bg-card p-5">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Today so far</h2>
          <div className="flex flex-wrap gap-x-10 gap-y-3">
            <Figure label="Orders" value={summary.orders} />
            <Figure label="Revenue" value={money(summary.revenue, currency)} />
            {summary.cancelled > 0 && <Figure label="Cancelled" value={summary.cancelled} />}
          </div>
          {summary.top_items.length > 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              <TrendingUp className="mr-1.5 inline size-4 align-[-3px]" />
              Best sellers: {summary.top_items.map((i) => `${i.name} × ${i.quantity}`).join(', ')}
            </p>
          )}
        </section>
      )}
    </>
  )
}

function Figure({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

function OrderCard({
  order,
  currency,
  now,
  isNew,
  busy,
  onMove,
}: {
  order: Order
  currency: string
  now: number
  isNew: boolean
  busy: boolean
  onMove: (status: OrderStatus) => void
}) {
  const next = NEXT_STEP[order.status]
  const status = STATUS[order.status]
  const finished = order.status === 'COMPLETED' || order.status === 'CANCELLED'
  const charges = order.service_charge + order.tax
  const late = lateness(order, now)
  return (
    <article
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border border-l-4 bg-card shadow-xs transition-shadow',
        late === 'on-time' && 'border-l-border',
        late === 'late' && 'border-l-amber-400',
        late === 'very-late' && 'border-l-red-600',
        isNew && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
        finished && 'opacity-80',
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b p-4">
        <div className="min-w-0">
          <p className="font-heading text-2xl leading-tight font-semibold">{order.table_name}</p>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            #{order.reference} · {order.customer_name} ·{' '}
            <a href={`tel:${order.customer_phone}`} className="hover:text-foreground hover:underline">
              {order.customer_phone}
            </a>
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', status.className)}>
            {isNew ? 'New!' : status.label}
          </span>
          <span
            className={cn(
              'flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-medium tabular-nums',
              late === 'on-time' && 'text-muted-foreground',
              late === 'late' && 'bg-amber-100 text-amber-900',
              late === 'very-late' && 'bg-red-600 text-white',
            )}
            title={`Ordered at ${clockTime(order.created_at)}`}
          >
            <Clock className="size-3.5" />
            {finished ? clockTime(order.created_at) : timeSince(order.created_at, now)}
          </span>
        </div>
      </header>

      <div className="flex-1 space-y-3 p-4">
        <ul className="space-y-1.5 text-base">
          {order.items.map((i) => (
            <li key={i.name} className="flex gap-2">
              <span className="w-8 shrink-0 font-bold tabular-nums">{i.quantity}×</span>
              <span className="font-medium">{i.name}</span>
            </li>
          ))}
        </ul>
        {order.notes && (
          <p className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 font-medium text-amber-900">
            <StickyNote className="mt-0.5 size-4 shrink-0" />
            {order.notes}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{money(order.total, currency)}</span>
          {charges > 0 && ` incl. ${money(charges, currency)} service & tax`}
        </p>
      </div>

      {(next || CANCELLABLE.includes(order.status)) && (
        <footer className="flex gap-2 border-t p-3">
          {next && (
            <Button size="xl" className="flex-1" disabled={busy} onClick={() => onMove(next.status)}>
              <next.icon /> {next.label}
            </Button>
          )}
          {CANCELLABLE.includes(order.status) && (
            <Button
              size="icon-xl"
              variant="outline"
              disabled={busy}
              onClick={() => onMove('CANCELLED')}
              aria-label={`Cancel order #${order.reference}`}
              title="Cancel order"
            >
              <X />
            </Button>
          )}
        </footer>
      )}
    </article>
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
