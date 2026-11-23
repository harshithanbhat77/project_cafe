import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classifyNotificationEvents,
  createAdminNotificationEvents,
  deliverAdminNotification,
  getNotificationPermissionStatus,
  readSeenNotificationKeys,
  requestBrowserNotificationPermission,
  storeSeenNotificationKeys,
} from './admin-notifications.ts'

const events = createAdminNotificationEvents(
  [{ id: 12, reference: 'CF-00012', table_name: 'Table 4', customer_name: 'Aanya' }],
  [
    { id: 21, kind: 'WAITER', table_name: 'Table 5', customer_name: 'Sam' },
    { id: 22, kind: 'BILL', table_name: 'Patio 1', customer_name: 'Riya' },
  ],
)

test('builds order, waiter, and bill events with useful details and destinations', () => {
  assert.deepEqual(events.map(({ key }) => key), ['order:12', 'request:21', 'request:22'])
  assert.match(events[0].body, /CF-00012.*Aanya/)
  assert.match(events[1].body, /Sam.*Table 5.*waiter/)
  assert.match(events[2].body, /Riya.*Patio 1.*bill/)
  assert.equal(events[0].href, '/admin#order-12')
  assert.equal(events[2].href, '/admin#guest-request-22')
})

test('initial events are baselined and later events are emitted only once', () => {
  const baseline = classifyNotificationEvents(events, new Set(), false)
  assert.deepEqual(baseline.newEvents, [])

  const next = classifyNotificationEvents([events[0], events[1]], baseline.seenKeys, true)
  assert.deepEqual(next.newEvents, [])

  const fresh = { ...events[0], key: 'order:13' }
  const detected = classifyNotificationEvents([fresh, events[2]], next.seenKeys, true)
  assert.deepEqual(detected.newEvents, [fresh])
  assert.deepEqual(classifyNotificationEvents([fresh], detected.seenKeys, true).newEvents, [])
})

test('persists and restores seen event keys', () => {
  const data = new Map<string, string>()
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  }
  storeSeenNotificationKeys(storage, new Set(['order:12', 'request:21']))
  assert.deepEqual(readSeenNotificationKeys(storage), new Set(['order:12', 'request:21']))
})

test('reports granted, denied, default, and unsupported permission states', async () => {
  assert.equal(getNotificationPermissionStatus(true, 'granted'), 'granted')
  assert.equal(getNotificationPermissionStatus(true, 'denied'), 'denied')
  assert.equal(getNotificationPermissionStatus(true, 'default'), 'default')
  assert.equal(getNotificationPermissionStatus(false), 'unsupported')
  assert.equal(await requestBrowserNotificationPermission(true, async () => 'granted'), 'granted')
  assert.equal(await requestBrowserNotificationPermission(false, async () => 'granted'), 'unsupported')
})

test('uses desktop notifications while hidden and navigates when clicked', () => {
  let created: { title: string; body: string; tag: string } | undefined
  let shown: { onclick: ((event: Event) => unknown) | null; close: () => void } | undefined
  let clicked = false
  let target = ''
  let closed = false
  const outcome = deliverAdminNotification(
    events[0],
    'granted',
    true,
    (title, options) => {
      created = { title, ...options }
      shown = { onclick: null, close: () => (closed = true) }
      return shown
    },
    () => assert.fail('unexpected in-app fallback'),
    () => (clicked = true),
    (href) => (target = href),
  )

  assert.equal(outcome, 'native')
  assert.deepEqual(created, { title: events[0].title, body: events[0].body, tag: events[0].key })
  shown?.onclick?.(new Event('click'))
  assert.equal(clicked, true)
  assert.equal(target, events[0].href)
  assert.equal(closed, true)
})

test('falls back in-app when permission is denied, unsupported, or the page is visible', () => {
  const fallbacks: string[] = []
  for (const [permission, hidden, create] of [
    ['denied', true, undefined],
    ['unsupported', true, undefined],
    ['granted', false, undefined],
  ] as const) {
    assert.equal(
      deliverAdminNotification(events[0], permission, hidden, create, (event) => fallbacks.push(event.key), () => {}, () => {}),
      'fallback',
    )
  }
  assert.deepEqual(fallbacks, ['order:12', 'order:12', 'order:12'])
})
