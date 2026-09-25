import { money } from '../../api'
import type { Cart, Menu } from './types'

export default function MenuView({
  menu,
  name,
  cart,
  error,
  onAdd,
}: {
  menu: Menu
  name: string
  cart: Cart
  error: string
  onAdd: (id: number) => void
}) {
  return (
    <>
      <section className="hero">
        <p>Good food, good company</p>
        <h1>Take a little time for something delicious.</h1>
        <p>Hi {name || 'there'} - order from your table and we&apos;ll bring it right over.</p>
      </section>
      {error && <div className="error">{error}</div>}
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
                    <span className="price">{money(i.price)}</span>
                    <button className="add" disabled={!i.available} onClick={() => onAdd(i.id)}>
                      {!i.available ? 'Sold out' : `Add ${cart[i.id] ? `· ${cart[i.id]}` : ''}`}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
