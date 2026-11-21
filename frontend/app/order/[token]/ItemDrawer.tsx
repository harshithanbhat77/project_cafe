'use client'
import { useState } from 'react'
import { Check, Flame, Plus, Star } from 'lucide-react'
import { DIET_LABEL, DietMarker } from '@/components/diet-marker'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerTitle } from '@/components/ui/drawer'
import { imageSrc, money } from '@/lib/api'
import QuantityStepper from './QuantityStepper'
import type { Cart, Item } from './types'

/** Bottom sheet with a big photo and the full description of one dish. */
export default function ItemDrawer({
  item: openItem,
  currency,
  cart,
  onChange,
  onClose,
}: {
  item: Item | null
  currency: string
  cart: Cart
  onChange: (id: number, delta: number) => void
  onClose: () => void
}) {
  // Keep showing the last dish while the drawer slides closed.
  const [item, setItem] = useState(openItem)
  if (openItem && openItem !== item) setItem(openItem)
  const quantity = item ? cart[item.id] || 0 : 0
  const change = (delta: number) => item && onChange(item.id, delta)
  const image = imageSrc(item?.image_url)
  return (
    <Drawer open={openItem !== null} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="mx-auto max-w-lg">
        {item && (
          <>
            <div className="overflow-y-auto">
              {image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="" className="mt-3 aspect-[4/3] w-full bg-muted object-cover sm:rounded-t-xl" />
              )}
              <div className="space-y-3 px-5 pt-5">
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                  {item.diet && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1">
                      <DietMarker diet={item.diet} className="size-3.5" /> {DIET_LABEL[item.diet]}
                    </span>
                  )}
                  {item.spicy && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-red-700">
                      <Flame className="size-3.5" /> Spicy
                    </span>
                  )}
                  {item.bestseller && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-primary">
                      <Star className="size-3.5 fill-current" /> Bestseller
                    </span>
                  )}
                </div>
                <DrawerTitle className="text-xl font-semibold">{item.name}</DrawerTitle>
                <DrawerDescription className="text-base leading-relaxed">
                  {item.description || 'Freshly made to order.'}
                </DrawerDescription>
                <p className="text-lg font-semibold tabular-nums">{money(item.price, currency)}</p>
              </div>
            </div>
            <DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
              {!item.available ? (
                <Button size="xl" disabled>
                  Sold out for now
                </Button>
              ) : quantity === 0 ? (
                <Button size="xl" onClick={() => change(1)}>
                  <Plus /> Add to order · {money(item.price, currency)}
                </Button>
              ) : (
                <div className="flex items-center gap-3">
                  <QuantityStepper quantity={quantity} name={item.name} onChange={change} size="lg" />
                  <Button size="xl" className="flex-1" onClick={onClose}>
                    <Check /> Done · {money(item.price * quantity, currency)}
                  </Button>
                </div>
              )}
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}
