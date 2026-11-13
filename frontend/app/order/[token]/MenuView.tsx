'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Search, SearchX, X } from 'lucide-react'
import { DietMarker, isVegetarian } from '@/components/diet-marker'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { imageSrc, money } from '@/lib/api'
import { cn } from '@/lib/utils'
import { HelpTrigger } from './HelpDrawer'
import ItemDrawer from './ItemDrawer'
import QuantityStepper from './QuantityStepper'
import type { Cart, Item, Menu } from './types'

export default function MenuView({
  menu,
  name,
  cart,
  onChange,
  helpPending,
  onHelp,
}: {
  menu: Menu
  name: string
  cart: Cart
  onChange: (id: number, delta: number) => void
  helpPending: boolean
  onHelp: () => void
}) {
  const currency = menu.restaurant.currency
  const [query, setQuery] = useState('')
  const [vegOnly, setVegOnly] = useState(false)
  const [openItem, setOpenItem] = useState<Item | null>(null)

  const categories = useMemo(() => {
    const q = query.trim().toLowerCase()
    return menu.categories
      .map((c) => ({
        ...c,
        items: c.items.filter(
          (i) =>
            (!vegOnly || isVegetarian(i.diet)) &&
            (!q || i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)),
        ),
      }))
      .filter((c) => c.items.length > 0)
  }, [menu.categories, query, vegOnly])

  const active = useActiveSection(categories.map((c) => c.id))
  const tabsRef = useRef<HTMLDivElement>(null)

  // Keep the highlighted tab visible in the horizontal tab strip.
  useEffect(() => {
    const strip = tabsRef.current
    const tab = strip?.querySelector<HTMLElement>(`[data-tab="${active.id}"]`)
    if (strip && tab) strip.scrollTo({ left: tab.offsetLeft - strip.clientWidth / 2 + tab.clientWidth / 2, behavior: 'smooth' })
  }, [active.id])

  function jumpTo(id: number) {
    active.set(id)
    document.getElementById(`category-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      {name && <p className="-mt-2 pb-4 text-center text-sm text-muted-foreground italic">Welcome back, {name.split(' ')[0]}</p>}

      {/* Search, veg filter, help and section tabs stay on screen while scrolling. */}
      <div data-sticky-menu-bar className="sticky top-0 z-20 border-y bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-1 px-2">
          <label className="relative flex min-w-0 flex-1 items-center">
            <Search className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the menu"
              aria-label="Search the menu"
              className="h-12 w-full min-w-0 bg-transparent pr-8 pl-9 text-base outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-1 flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </label>
          <label className="flex h-12 shrink-0 cursor-pointer items-center gap-2 border-l px-3 text-sm select-none">
            <DietMarker diet="VEG" />
            Veg
            <Switch checked={vegOnly} onCheckedChange={setVegOnly} aria-label="Show vegetarian dishes only" />
          </label>
          <HelpTrigger
            pending={helpPending}
            onClick={onHelp}
            compact
            className="h-12 shrink-0 rounded-none border-0 border-l bg-transparent px-3 shadow-none"
          />
        </div>
        <div
          ref={tabsRef}
          className="mx-auto flex max-w-3xl gap-5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Menu sections"
        >
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              data-tab={c.id}
              aria-selected={active.id === c.id}
              onClick={() => jumpTo(c.id)}
              className={cn(
                'shrink-0 border-b-2 py-3 text-sm whitespace-nowrap transition-colors',
                active.id === c.id
                  ? 'border-primary font-semibold text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 pb-36 sm:px-6">
        {categories.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <SearchX className="mb-3 size-9 text-muted-foreground" />
            <p className="font-heading text-xl">Nothing matches{query ? ` “${query}”` : ''}</p>
            <p className="mt-1 text-sm text-muted-foreground">Try another word, or see the whole menu.</p>
            <Button
              variant="outline"
              className="mt-5 rounded-full bg-card"
              onClick={() => {
                setQuery('')
                setVegOnly(false)
              }}
            >
              Show the whole menu
            </Button>
          </div>
        )}
        {categories.map((c) => (
          <section key={c.id} id={`category-${c.id}`} data-category={c.id} className="scroll-mt-28 pt-8">
            <h2 className="text-[1.65rem] leading-tight">{c.name}</h2>
            {c.description && <p className="text-sm text-muted-foreground italic">{c.description}</p>}
            <ul className="mt-2">
              {c.items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  currency={currency}
                  quantity={cart[item.id] || 0}
                  onOpen={() => setOpenItem(item)}
                  onChange={(delta) => onChange(item.id, delta)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <ItemDrawer item={openItem} currency={currency} cart={cart} onChange={onChange} onClose={() => setOpenItem(null)} />
    </>
  )
}

/** One dish, laid out like a line on a printed menu: name, dotted leader, price. */
function ItemRow({
  item,
  currency,
  quantity,
  onOpen,
  onChange,
}: {
  item: Item
  currency: string
  quantity: number
  onOpen: () => void
  onChange: (delta: number) => void
}) {
  const image = imageSrc(item.image_url)
  const notes = [item.bestseller && 'House favourite', item.spicy && 'Spicy'].filter(Boolean).join(' · ')
  return (
    <li className={cn('flex gap-4 border-b border-dashed py-5 last:border-b-0', !item.available && 'opacity-60')}>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className="flex items-baseline gap-2">
          <DietMarker diet={item.diet} className="translate-y-0.5 self-start" />
          <span className="font-heading text-lg leading-snug font-semibold">{item.name}</span>
          <span aria-hidden className="min-w-4 flex-1 -translate-y-1 border-b border-dotted border-muted-foreground/50" />
          <span className="font-semibold whitespace-nowrap tabular-nums">{money(item.price, currency)}</span>
        </span>
        {item.description && (
          <span className={cn('mt-1 line-clamp-2 block text-sm leading-relaxed text-muted-foreground', item.diet && 'pl-6')}>
            {item.description}
          </span>
        )}
        {(notes || !item.available) && (
          <span
            className={cn(
              'mt-1.5 block text-[11px] font-medium tracking-wider uppercase',
              item.available ? 'text-primary' : 'text-muted-foreground',
              item.diet && 'pl-6',
            )}
          >
            {item.available ? notes : 'Sold out today'}
          </span>
        )}
      </button>

      <div className="flex w-24 shrink-0 flex-col items-center gap-2">
        {image && (
          <button type="button" onClick={onOpen} className="relative" aria-label={`More about ${item.name}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt=""
              loading="lazy"
              className={cn('size-[4.75rem] rounded-full bg-muted object-cover', !item.available && 'grayscale')}
            />
          </button>
        )}
        {item.available &&
          (quantity > 0 ? (
            <QuantityStepper quantity={quantity} name={item.name} onChange={onChange} className="w-full justify-between" />
          ) : (
            <button
              type="button"
              onClick={() => onChange(1)}
              aria-label={`Add ${item.name}`}
              // Same size and place as the quantity stepper it turns into, so the row doesn't jump.
              className="flex h-[38px] w-full items-center justify-center gap-1 rounded-full border border-primary bg-card text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground active:scale-95"
            >
              <Plus className="size-4" /> Add
            </button>
          ))}
      </div>
    </li>
  )
}

/** Which menu section is currently at the top of the screen, for highlighting its tab:
 * the last section whose top has scrolled up to just below the sticky bar. */
function useActiveSection(ids: number[]) {
  const [activeId, setActiveId] = useState<number | undefined>(ids[0])
  const key = ids.join(',')

  useEffect(() => {
    let frame = 0
    function update() {
      frame = 0
      const bar = document.querySelector<HTMLElement>('[data-sticky-menu-bar]')?.getBoundingClientRect().bottom ?? 0
      let current = ids[0]
      for (const id of ids) {
        const top = document.getElementById(`category-${id}`)?.getBoundingClientRect().top
        if (top !== undefined && top <= bar + 24) current = id
      }
      // At the very bottom, a short last section can't reach the bar; count it as current.
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
      if (atBottom && window.scrollY > 0) current = ids[ids.length - 1]
      setActiveId(current)
    }
    const onScroll = () => {
      frame ||= requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { id: activeId, set: setActiveId }
}
