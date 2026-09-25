'use client'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import { money } from '../../api'
import { useAdmin } from '../admin-context'
import type { Category, MenuItem } from '../types'

export default function MenuPage() {
  const { call, isOwner } = useAdmin()
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [error, setError] = useState('')
  // Which item form is open: an item id, 'new' for the add form, or null.
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [newCategory, setNewCategory] = useState('')

  const load = useCallback(async () => {
    try {
      const [c, i] = await Promise.all([call<Category[]>('/api/admin/categories'), call<MenuItem[]>('/api/admin/menu')])
      setCategories(c)
      setItems(i)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [call])

  useEffect(() => {
    load()
  }, [load])

  /** Run a change, then reload. Returns false (and shows the error) if it failed. */
  async function run(action: () => Promise<unknown>): Promise<boolean> {
    setError('')
    try {
      await action()
      await load()
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    }
  }

  const toggleAvailable = (item: MenuItem) =>
    run(() => call(`/api/admin/menu/${item.id}/availability`, { method: 'POST', body: { available: !item.available } }))

  const toggleCategory = (category: Category) =>
    run(() => call(`/api/admin/categories/${category.id}`, { method: 'PATCH', body: { active: !category.active } }))

  async function addCategory(e: FormEvent) {
    e.preventDefault()
    if (await run(() => call('/api/admin/categories', { method: 'POST', body: { name: newCategory } }))) setNewCategory('')
  }

  async function saveItem(body: ItemBody, id?: number) {
    const saved = await run(() =>
      id ? call(`/api/admin/menu/${id}`, { method: 'PATCH', body }) : call('/api/admin/menu', { method: 'POST', body }),
    )
    if (saved) setEditing(null)
  }

  return (
    <div className="panel">
      <h2>Menu</h2>
      <p className="muted">
        {isOwner
          ? 'Mark items sold out when you run out. Hidden items and categories are not shown to guests.'
          : 'Mark items sold out when you run out. Only the owner can change items and prices.'}
      </p>
      {error && <div className="error">{error}</div>}

      {isOwner && (
        <div className="actions" style={{ marginBottom: 12 }}>
          <button onClick={() => setEditing('new')} disabled={categories.length === 0}>
            + Add item
          </button>
          <form className="inline-form" onSubmit={addCategory}>
            <input
              className="input"
              placeholder="New category name"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              required
              maxLength={80}
            />
            <button>Add category</button>
          </form>
        </div>
      )}
      {editing === 'new' && (
        <ItemForm categories={categories} onSave={(body) => saveItem(body)} onCancel={() => setEditing(null)} />
      )}

      {categories.map((category) => (
        <section key={category.id}>
          <h3 className="category">
            {category.name}
            {!category.active && <span className="tag">Hidden</span>}
            {isOwner && (
              <button className="pill" style={{ marginLeft: 10 }} onClick={() => toggleCategory(category)}>
                {category.active ? 'Hide category' : 'Show category'}
              </button>
            )}
          </h3>
          {items
            .filter((item) => item.category_id === category.id)
            .map((item) =>
              editing === item.id ? (
                <ItemForm
                  key={item.id}
                  item={item}
                  categories={categories}
                  onSave={(body) => saveItem(body, item.id)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div className="row" key={item.id}>
                  <div>
                    <strong>{item.name}</strong> · {money(item.price)}
                    {!item.available && <span className="tag warn">Sold out</span>}
                    {!item.active && <span className="tag">Hidden</span>}
                    {item.description && <div className="muted">{item.description}</div>}
                  </div>
                  <div className="actions">
                    <button onClick={() => toggleAvailable(item)}>
                      {item.available ? 'Mark sold out' : 'Back in stock'}
                    </button>
                    {isOwner && <button onClick={() => setEditing(item.id)}>Edit</button>}
                  </div>
                </div>
              ),
            )}
        </section>
      ))}
    </div>
  )
}

type ItemBody = {
  category_id: number
  name: string
  description: string
  price: string // sent as text so the server parses exact decimals
  image_url: string | null
  active: boolean
}

function ItemForm({
  item,
  categories,
  onSave,
  onCancel,
}: {
  item?: MenuItem
  categories: Category[]
  onSave: (body: ItemBody) => void
  onCancel: () => void
}) {
  const [categoryId, setCategoryId] = useState(item?.category_id ?? categories[0]?.id)
  const [name, setName] = useState(item?.name ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [price, setPrice] = useState(item ? item.price.toFixed(2) : '')
  const [imageUrl, setImageUrl] = useState(item?.image_url ?? '')
  const [active, setActive] = useState(item?.active ?? true)

  function submit(e: FormEvent) {
    e.preventDefault()
    onSave({
      category_id: Number(categoryId),
      name,
      description,
      price,
      image_url: imageUrl.trim() || null,
      active,
    })
  }

  return (
    <form className="panel form-grid" onSubmit={submit}>
      <h3 className="wide" style={{ marginTop: 0 }}>
        {item ? `Edit ${item.name}` : 'New item'}
      </h3>
      <label>
        Name
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
      </label>
      <label>
        Price (₹)
        <input
          className="input"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
          inputMode="decimal"
          pattern="\d+(\.\d{1,2})?"
          title="A price like 240 or 240.50"
        />
      </label>
      <label>
        Category
        <select className="input" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Image URL (https://, optional)
        <input className="input" type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} maxLength={500} />
      </label>
      <label className="wide">
        Description
        <input
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
        />
      </label>
      <label className="check wide">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Show on the menu
      </label>
      <div className="actions wide">
        <button className="primary">Save</button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
