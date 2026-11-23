export type NotificationPermissionStatus = NotificationPermission | 'unsupported'

export type AdminNotificationEvent = {
  key: string
  title: string
  body: string
  href: string
}

type OrderNotice = {
  id: number
  reference: string
  table_name: string
  customer_name: string
}

type RequestNotice = {
  id: number
  kind: 'WAITER' | 'BILL'
  table_name: string
  customer_name: string
}

type NotificationLike = {
  onclick: ((event: Event) => unknown) | null
  close?: () => void
}

const SEEN_KEY = 'cafeflow-owner-notification-events'
const MAX_STORED_EVENTS = 3000
export const NOTIFICATION_LOOKBACK_MS = 5 * 60 * 1000

export function getNotificationPermissionStatus(
  supported: boolean,
  permission: NotificationPermission = 'default',
): NotificationPermissionStatus {
  return supported ? permission : 'unsupported'
}

export function createAdminNotificationEvents(
  orders: OrderNotice[],
  requests: RequestNotice[],
): AdminNotificationEvent[] {
  return [
    ...orders.map((order) => ({
      key: `order:${order.id}`,
      title: `New order · ${order.table_name}`,
      body: `Order #${order.reference} from ${order.customer_name} was placed.`,
      href: `/admin#order-${order.id}`,
    })),
    ...requests.map((request) => ({
      key: `request:${request.id}`,
      title: request.kind === 'BILL' ? `Bill requested · ${request.table_name}` : `Waiter requested · ${request.table_name}`,
      body: `${request.customer_name} at ${request.table_name} ${request.kind === 'BILL' ? 'requested the bill' : 'asked for a waiter'}.`,
      href: `/admin#guest-request-${request.id}`,
    })),
  ]
}

export function classifyNotificationEvents(
  events: AdminNotificationEvent[],
  seenKeys: Set<string>,
  initialized: boolean,
): { newEvents: AdminNotificationEvent[]; seenKeys: Set<string> } {
  const nextSeenKeys = new Set(seenKeys)
  const newEvents = initialized ? events.filter((event) => !nextSeenKeys.has(event.key)) : []
  for (const event of events) nextSeenKeys.add(event.key)
  return { newEvents, seenKeys: nextSeenKeys }
}

export function readSeenNotificationKeys(storage?: Pick<Storage, 'getItem'>): Set<string> {
  if (!storage) return new Set()
  try {
    const stored = JSON.parse(storage.getItem(SEEN_KEY) ?? '[]')
    return new Set(Array.isArray(stored) ? stored.filter((key): key is string => typeof key === 'string') : [])
  } catch (error) {
    console.warn('Could not read notification history from local storage.', error)
    return new Set()
  }
}

export function storeSeenNotificationKeys(storage: Pick<Storage, 'setItem'> | undefined, keys: Set<string>): void {
  if (!storage) return
  try {
    storage.setItem(SEEN_KEY, JSON.stringify(Array.from(keys).slice(-MAX_STORED_EVENTS)))
  } catch (error) {
    console.warn('Could not save notification history to local storage.', error)
  }
}

export function deliverAdminNotification(
  event: AdminNotificationEvent,
  permission: NotificationPermissionStatus,
  hidden: boolean,
  create: ((title: string, options: { body: string; tag: string }) => NotificationLike) | undefined,
  fallback: (event: AdminNotificationEvent) => void,
  focus: () => void,
  navigate: (href: string) => void,
): 'native' | 'fallback' {
  if (permission !== 'granted' || !hidden || !create) {
    fallback(event)
    return 'fallback'
  }

  try {
    const notification = create(event.title, { body: event.body, tag: event.key })
    notification.onclick = () => {
      focus()
      navigate(event.href)
      notification.close?.()
    }
    return 'native'
  } catch (error) {
    console.warn('Could not create a desktop notification; showing it in the dashboard instead.', error)
    fallback(event)
    return 'fallback'
  }
}

export async function requestBrowserNotificationPermission(
  supported: boolean,
  request: () => Promise<NotificationPermission>,
): Promise<NotificationPermissionStatus> {
  if (!supported) return 'unsupported'
  return request()
}
