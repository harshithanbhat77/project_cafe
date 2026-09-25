import { money } from '../../api'
import type { Order, OrderStatus } from './types'

const STATUS_TEXT: Record<OrderStatus, string> = {
  PLACED: 'Waiting for the cafe to confirm',
  ACCEPTED: 'Confirmed',
  PREPARING: 'Being prepared',
  READY: 'Ready, on its way',
  COMPLETED: 'Served',
  CANCELLED: 'Cancelled, please ask staff',
}

export default function MyOrders({
  orders,
  taxLabel,
  onOrderMore,
}: {
  orders: Order[]
  taxLabel: string
  onOrderMore: () => void
}) {
  return (
    <>
      <div className="hero">
        <p>Your orders</p>
        <h1>Thank you - we&apos;re on it.</h1>
        <p>This page updates by itself. Staff will bring everything to your table.</p>
      </div>
      <button className="primary" onClick={onOrderMore}>
        Order more
      </button>
      {orders.map((o) => (
        <div className="panel" key={o.id}>
          <span className={o.status === 'CANCELLED' ? 'status cancelled' : 'status'}>{STATUS_TEXT[o.status]}</span>
          <h2>Order #{o.reference}</h2>
          {o.items.map((i) => (
            <p key={i.name}>
              {i.name} × {i.quantity}
              <strong style={{ float: 'right' }}>{money(i.line_total)}</strong>
            </p>
          ))}
          {o.notes && <div className="order-note">Note: {o.notes}</div>}
          <hr />
          {o.service_charge > 0 && (
            <p>
              Service charge<span style={{ float: 'right' }}>{money(o.service_charge)}</span>
            </p>
          )}
          {o.tax > 0 && (
            <p>
              {taxLabel}
              <span style={{ float: 'right' }}>{money(o.tax)}</span>
            </p>
          )}
          <p>
            <strong>Total</strong>
            <strong style={{ float: 'right' }}>{money(o.total)}</strong>
          </p>
        </div>
      ))}
    </>
  )
}
