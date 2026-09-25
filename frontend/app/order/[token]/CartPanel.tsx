import { money } from '../../api'
import type { Cart, Menu } from './types'

/** Rounds to paise. Only used for the estimate: the server works out the real bill. */
const round = (n: number) => Math.round(n * 100) / 100

export default function CartPanel({
  menu,
  cart,
  notes,
  open,
  busy,
  error,
  onOpen,
  onClose,
  onChange,
  onNotes,
  onCheckout,
}: {
  menu: Menu
  cart: Cart
  notes: string
  open: boolean
  busy: boolean
  error: string
  onOpen: () => void
  onClose: () => void
  onChange: (id: number, delta: number) => void
  onNotes: (notes: string) => void
  onCheckout: () => void
}) {
  const items = menu.categories.flatMap((c) => c.items).filter((i) => cart[i.id])
  const count = items.reduce((n, i) => n + cart[i.id], 0)
  const subtotal = round(items.reduce((s, i) => s + i.price * cart[i.id], 0))
  const { service_charge_percent, tax_percent, tax_label } = menu.charges
  const service = round((subtotal * service_charge_percent) / 100)
  const tax = round(((subtotal + service) * tax_percent) / 100)
  const total = round(subtotal + service + tax)

  if (count === 0) return null
  if (!open)
    return (
      <button className="cart" onClick={onOpen}>
        View order · {count} items · {money(subtotal)}
      </button>
    )

  return (
    <aside className="cart-panel">
      <div className="topbar">
        <h2 style={{ margin: 0 }}>Your order</h2>
        <button className="pill" onClick={onClose}>
          Close
        </button>
      </div>
      {items.map((i) => (
        <div className="cart-line" key={i.id}>
          <div>
            <strong>{i.name}</strong>
            <div>{money(i.price)} each</div>
          </div>
          <div className="quantity">
            <button onClick={() => onChange(i.id, -1)}>-</button>
            <strong>{cart[i.id]}</strong>
            <button onClick={() => onChange(i.id, 1)}>+</button>
          </div>
        </div>
      ))}
      <textarea
        className="input"
        placeholder="Anything we should know? e.g. less spicy, no onion"
        value={notes}
        onChange={(e) => onNotes(e.target.value)}
        maxLength={300}
        rows={2}
      />
      {service + tax > 0 && (
        <>
          <p>
            Items<span style={{ float: 'right' }}>{money(subtotal)}</span>
          </p>
          {service > 0 && (
            <p>
              Service charge ({service_charge_percent}%)<span style={{ float: 'right' }}>{money(service)}</span>
            </p>
          )}
          {tax > 0 && (
            <p>
              {tax_label} ({tax_percent}%)<span style={{ float: 'right' }}>{money(tax)}</span>
            </p>
          )}
        </>
      )}
      <p>
        <strong>Total{service + tax > 0 && ' (estimate)'}</strong>
        <strong style={{ float: 'right' }}>{money(total)}</strong>
      </p>
      {error && <div className="error">{error}</div>}
      <div className="cart-actions">
        <button className="primary" onClick={onCheckout} disabled={busy}>
          {busy ? 'Placing order...' : 'Place order'}
        </button>
      </div>
    </aside>
  )
}
