'use client'
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { EyeOff, Flame, FolderPlus, ImageOff, Loader2, MoreHorizontal, Pencil, Plus, Search, Star, UtensilsCrossed } from 'lucide-react'
import { toast } from 'sonner'
import { DIET_SHORT, DietMarker, type Diet } from '@/components/diet-marker'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { imageSrc, money } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAdmin } from '../admin-context'
import { ImagePicker } from '../image-picker'
import type { Category, MenuItem } from '../types'
import { EmptyState, ErrorBanner, PageHeader } from '../ui'

type ItemBody = {
  category_id: number
  name: string
  description: string
  price: string // sent as text so the server parses exact decimals
  image_url: string | null
  active: boolean
  diet: Diet | null
  spicy: boolean
  bestseller: boolean
}

export default function MenuPage() {
  const { call, isOwner, restaurant } = useAdmin()
  const currency = restaurant?.currency ?? 'INR'
  const [categories, setCategories] = useState<Category[] | null>(null)
  const [items, setItems] = useState<MenuItem[]>([])
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  // Which item is open in the editor: an item, 'new', or null.
  const [editing, setEditing] = useState<MenuItem | 'new' | null>(null)
  const [categoryDialog, setCategoryDialog] = useState<Category | 'new' | null>(null)

  const load = useCallback(async () => {
    try {
      const [c, i] = await Promise.all([call<Category[]>('/api/admin/categories'), call<MenuItem[]>('/api/admin/menu')])
      setCategories(c)
      setItems(i)
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }, [call])

  useEffect(() => {
    load()
  }, [load])

  async function toggleAvailable(item: MenuItem) {
    // Update straight away; the switch should feel instant during a busy service.
    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, available: !item.available } : i)))
    try {
      await call(`/api/admin/menu/${item.id}/availability`, { method: 'POST', body: { available: !item.available } })
      toast(item.available ? `${item.name} marked sold out` : `${item.name} is back in stock`)
    } catch (e) {
      toast.error((e as Error).message)
      load()
    }
  }

  async function toggleCategory(category: Category) {
    try {
      await call(`/api/admin/categories/${category.id}`, { method: 'PATCH', body: { active: !category.active } })
      toast(category.active ? `${category.name} is hidden from guests` : `${category.name} is visible to guests`)
      load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (categories ?? [])
      .filter((c) => categoryFilter === 'all' || String(c.id) === categoryFilter)
      .map((c) => ({
        category: c,
        items: items.filter(
          (i) => i.category_id === c.id && (!q || i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)),
        ),
      }))
      .filter((group) => !q || group.items.length > 0)
  }, [categories, items, query, categoryFilter])

  const soldOut = items.filter((i) => !i.available && i.active).length

  return (
    <>
      <PageHeader
        title="Menu"
        description={
          isOwner
            ? 'Mark dishes sold out when you run out. Hidden dishes and sections are not shown to guests.'
            : 'Mark dishes sold out when you run out. Only the owner can change dishes and prices.'
        }
        actions={
          isOwner && (
            <>
              <Button variant="outline" size="lg" onClick={() => setCategoryDialog('new')}>
                <FolderPlus /> New section
              </Button>
              <Button size="lg" onClick={() => setEditing('new')} disabled={!categories?.length}>
                <Plus /> Add dish
              </Button>
            </>
          )
        }
      />
      <ErrorBanner message={error} />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search dishes"
            aria-label="Search dishes"
            className="h-10 bg-card pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-10 w-full bg-card sm:w-56" aria-label="Filter by section">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sections</SelectItem>
            {categories?.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {soldOut > 0 && !query && categoryFilter === 'all' && (
        <p className="mb-4 text-sm text-muted-foreground">
          {soldOut} {soldOut === 1 ? 'dish is' : 'dishes are'} marked sold out.
        </p>
      )}

      {categories === null ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <EmptyState icon={UtensilsCrossed} title="Your menu is empty">
          {isOwner ? 'Start by adding a section, like “Breakfast” or “Drinks”, then add dishes to it.' : 'The owner hasn’t added any dishes yet.'}
        </EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState icon={Search} title={`No dishes match “${query}”`} />
      ) : (
        <div className="space-y-6">
          {visible.map(({ category, items: rows }) => (
            <section key={category.id} className="overflow-hidden rounded-2xl border bg-card">
              <header className="flex items-center gap-3 border-b bg-muted/40 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <h2 className="flex items-center gap-2 font-semibold">
                    {category.name}
                    <span className="text-sm font-normal text-muted-foreground">{rows.length}</span>
                    {!category.active && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        <EyeOff className="size-3" /> Hidden
                      </span>
                    )}
                  </h2>
                  {category.description && <p className="truncate text-sm text-muted-foreground">{category.description}</p>}
                </div>
                {isOwner && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-lg" aria-label={`${category.name} options`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setCategoryDialog(category)}>
                        <Pencil /> Rename section
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => toggleCategory(category)}>
                        <EyeOff /> {category.active ? 'Hide from guests' : 'Show to guests'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </header>
              {rows.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">No dishes in this section yet.</p>
              ) : (
                <ul className="divide-y">
                  {rows.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      currency={currency}
                      isOwner={isOwner}
                      onToggle={() => toggleAvailable(item)}
                      onEdit={() => setEditing(item)}
                    />
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      {categories && (
        <ItemEditor
          key={`item-${editing === 'new' ? 'new' : editing?.id ?? 'closed'}`}
          open={editing !== null}
          item={editing === 'new' ? undefined : editing ?? undefined}
          categories={categories}
          defaultCategory={categoryFilter === 'all' ? undefined : Number(categoryFilter)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
      <CategoryDialog
        key={`category-${categoryDialog === 'new' ? 'new' : categoryDialog?.id ?? 'closed'}`}
        category={categoryDialog}
        onClose={() => setCategoryDialog(null)}
        onSaved={() => {
          setCategoryDialog(null)
          load()
        }}
      />
    </>
  )
}

function ItemRow({
  item,
  currency,
  isOwner,
  onToggle,
  onEdit,
}: {
  item: MenuItem
  currency: string
  isOwner: boolean
  onToggle: () => void
  onEdit: () => void
}) {
  const image = imageSrc(item.image_url)
  return (
    <li className={cn('flex items-center gap-3 px-4 py-3', !item.active && 'bg-muted/30')}>
      <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" loading="lazy" className={cn('size-full object-cover', !item.available && 'grayscale')} />
        ) : (
          <ImageOff className="m-auto mt-4 size-5 text-muted-foreground/60" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <DietMarker diet={item.diet} className="size-3.5" />
          <span className={cn('font-medium', !item.active && 'text-muted-foreground')}>{item.name}</span>
          {item.bestseller && <Star className="size-3.5 fill-primary text-primary" aria-label="Bestseller" />}
          {item.spicy && <Flame className="size-3.5 text-red-600" aria-label="Spicy" />}
          {!item.active && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Hidden</span>
          )}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">{money(item.price, currency)}</span>
          {item.description && ` · ${item.description}`}
        </p>
      </div>
      <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm">
        <span className={cn('hidden w-16 text-right sm:inline', item.available ? 'text-muted-foreground' : 'font-medium text-destructive')}>
          {item.available ? 'In stock' : 'Sold out'}
        </span>
        <Switch checked={item.available} onCheckedChange={onToggle} aria-label={`${item.name} in stock`} />
      </label>
      {isOwner && (
        <Button variant="ghost" size="icon-lg" onClick={onEdit} aria-label={`Edit ${item.name}`}>
          <Pencil />
        </Button>
      )}
    </li>
  )
}

function ItemEditor({
  open,
  item,
  categories,
  defaultCategory,
  onClose,
  onSaved,
}: {
  open: boolean
  item?: MenuItem
  categories: Category[]
  defaultCategory?: number
  onClose: () => void
  onSaved: () => void
}) {
  const { call, restaurant } = useAdmin()
  const [form, setForm] = useState({
    category_id: String(item?.category_id ?? defaultCategory ?? categories[0]?.id ?? ''),
    name: item?.name ?? '',
    description: item?.description ?? '',
    price: item ? item.price.toFixed(2).replace(/\.00$/, '') : '',
    image_url: item?.image_url ?? '',
    active: item?.active ?? true,
    diet: (item?.diet ?? '') as Diet | '',
    spicy: item?.spicy ?? false,
    bestseller: item?.bestseller ?? false,
  })
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    const body: ItemBody = {
      category_id: Number(form.category_id),
      name: form.name.trim(),
      description: form.description.trim(),
      price: form.price,
      image_url: form.image_url || null,
      active: form.active,
      diet: form.diet || null,
      spicy: form.spicy,
      bestseller: form.bestseller,
    }
    setBusy(true)
    try {
      if (item) await call(`/api/admin/menu/${item.id}`, { method: 'PATCH', body })
      else await call('/api/admin/menu', { method: 'POST', body })
      toast.success(item ? `${body.name} saved` : `${body.name} added to the menu`)
      onSaved()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-lg">
        <form onSubmit={submit} className="flex h-full flex-col">
          <SheetHeader className="border-b">
            <SheetTitle className="text-lg">{item ? `Edit ${item.name}` : 'Add a dish'}</SheetTitle>
            <SheetDescription>Guests see these details on the menu.</SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            <ImagePicker value={form.image_url} onChange={(url) => set('image_url', url)} />

            <div className="space-y-2">
              <Label htmlFor="item-name">Name</Label>
              <Input id="item-name" value={form.name} onChange={(e) => set('name', e.target.value)} required maxLength={120} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="item-price">Price ({currency(restaurant?.currency)})</Label>
                <Input
                  id="item-price"
                  value={form.price}
                  onChange={(e) => set('price', e.target.value)}
                  required
                  inputMode="decimal"
                  pattern="\d+(\.\d{1,2})?"
                  title="A price like 240 or 240.50"
                  placeholder="240"
                />
              </div>
              <div className="space-y-2">
                <Label>Section</Label>
                <Select value={form.category_id} onValueChange={(v) => set('category_id', v)}>
                  <SelectTrigger className="w-full" aria-label="Section">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-description">Description</Label>
              <Textarea
                id="item-description"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="What's in it? e.g. Sourdough, smashed avocado, chilli flakes"
              />
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <ToggleGroup
                type="single"
                variant="outline"
                value={form.diet}
                onValueChange={(v) => set('diet', v as Diet | '')}
                className="flex w-full flex-wrap"
              >
                {(Object.keys(DIET_SHORT) as Diet[]).map((d) => (
                  <ToggleGroupItem key={d} value={d} className="h-9 flex-1 gap-1.5 px-2 text-xs">
                    <DietMarker diet={d} className="size-3.5" />
                    {DIET_SHORT[d]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <p className="text-xs text-muted-foreground">Tap the selected type again to clear it.</p>
            </div>

            <div className="divide-y rounded-xl border">
              <ToggleRow label="Spicy" hint="Shows a chilli badge" checked={form.spicy} onChange={(v) => set('spicy', v)} />
              <ToggleRow
                label="Bestseller"
                hint="Highlights the dish on the menu"
                checked={form.bestseller}
                onChange={(v) => set('bestseller', v)}
              />
              <ToggleRow
                label="Show on the menu"
                hint="Turn off to hide it from guests without deleting it"
                checked={form.active}
                onChange={(v) => set('active', v)}
              />
            </div>
          </div>

          <SheetFooter className="flex-row border-t">
            <Button type="button" variant="outline" size="xl" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button size="xl" className="flex-1" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {item ? 'Save changes' : 'Add dish'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

/** "₹" for INR, "$" for USD, otherwise the currency code. */
function currency(code = 'INR'): string {
  const part = new Intl.NumberFormat('en', { style: 'currency', currency: code })
    .formatToParts(0)
    .find((p) => p.type === 'currency')
  return part?.value ?? code
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 px-3 py-3">
      <span className="flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  )
}

function CategoryDialog({
  category,
  onClose,
  onSaved,
}: {
  category: Category | 'new' | null
  onClose: () => void
  onSaved: () => void
}) {
  const { call } = useAdmin()
  const existing = category && category !== 'new' ? category : null
  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const body = { name: name.trim(), description: description.trim() }
      if (existing) await call(`/api/admin/categories/${existing.id}`, { method: 'PATCH', body })
      else await call('/api/admin/categories', { method: 'POST', body })
      toast.success(existing ? 'Section saved' : `${body.name} added`)
      onSaved()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={category !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{existing ? 'Rename section' : 'New menu section'}</DialogTitle>
            <DialogDescription>Sections group dishes on the menu, like “Breakfast” or “Drinks”.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="category-name">Name</Label>
            <Input id="category-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category-description">Short description (optional)</Label>
            <Input
              id="category-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              placeholder="e.g. Served until noon"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {existing ? 'Save' : 'Add section'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
