'use client'
import { ChevronRight, Loader2, ShoppingBag } from 'lucide-react'
import { DietMarker } from '@/components/diet-marker'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { money } from '@/lib/api'
import GuestDetails, { type Guest } from './GuestDetails'
import QuantityStepper from './QuantityStepper'
import type { Cart, Menu } from './types'

/** Rounds to paise/cents. Only used for the estimate: the server works out the real bill. */
const round = (n: number) => Math.round(n * 100) / 100

export default function CartPanel({
  menu,
  cart,
  notes,
  needsDetails,
  guest,
  onGuest,
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
  /** First order: ask for name and phone in the cart. */
  needsDetails: boolean
  guest: Guest
  onGuest: (guest: Guest) => void
  open: boolean
  busy: boolean
  error: string
  onOpen: () => void
  onClose: () => void
  onChange: (id: number, delta: number) => void
  onNotes: (notes: string) => void
  onCheckout: () => void
}) {
  const currency = menu.restaurant.currency
  const items = menu.categories.flatMap((c) => c.items).filter((i) => cart[i.id])
  const count = items.reduce((n, i) => n + cart[i.id], 0)
  const subtotal = round(items.reduce((s, i) => s + i.price * cart[i.id], 0))
  const { service_charge_percent, tax_percent, tax_label } = menu.charges
  const service = round((subtotal * service_charge_percent) / 100)
  const tax = round(((subtotal + service) * tax_percent) / 100)
  const total = round(subtotal + service + tax)
  const hasCharges = service + tax > 0

  return (
    <>
      {count > 0 && !open && (
        <div className="fixed inset-x-0 bottom-0 z-30 bg-ink text-paper animate-in slide-in-from-bottom-4">
          <button
            type="button"
            onClick={onOpen}
            className="mx-auto flex w-full max-w-3xl items-center gap-3 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-left"
          >
            <ShoppingBag className="size-5 opacity-80" />
            <span className="flex-1">
              {count} {count === 1 ? 'item' : 'items'} · <span className="font-semibold tabular-nums">{money(subtotal, currency)}</span>
            </span>
            <span className="flex items-center gap-1 font-heading text-lg italic">
              View order <ChevronRight className="size-5" />
            </span>
          </button>
        </div>
      )}

      <Drawer open={open && count > 0} onOpenChange={(o) => !o && onClose()}>
        <DrawerContent className="mx-auto max-w-lg">
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(e) => {
              e.preventDefault()
              onCheckout()
            }}
          >
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-xl">Your order</DrawerTitle>
            <DrawerDescription>
              {menu.table.name} · {count} {count === 1 ? 'item' : 'items'}
            </DrawerDescription>
          </DrawerHeader>

          <div className="space-y-5 overflow-y-auto px-4">
            <ul className="divide-y divide-dashed border-y border-dashed">
              {items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-3">
                  <DietMarker diet={i.diet} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-heading text-[17px] font-semibold">{i.name}</p>
                    <p className="text-sm text-muted-foreground tabular-nums">{money(i.price * cart[i.id], currency)}</p>
                  </div>
                  <QuantityStepper quantity={cart[i.id]} name={i.name} onChange={(d) => onChange(i.id, d)} />
                </li>
              ))}
            </ul>

            <div className="space-y-2">
              <Label htmlFor="order-notes">Anything the kitchen should know?</Label>
              <Textarea
                id="order-notes"
                placeholder="e.g. less spicy, no onion, allergic to nuts"
                value={notes}
                onChange={(e) => onNotes(e.target.value)}
                maxLength={300}
                rows={2}
                className="text-base"
              />
            </div>

            <dl className="space-y-1.5 text-sm">
              {hasCharges && (
                <>
                  <Row label="Items" value={money(subtotal, currency)} />
                  {service > 0 && <Row label={`Service charge (${service_charge_percent}%)`} value={money(service, currency)} />}
                  {tax > 0 && <Row label={`${tax_label} (${tax_percent}%)`} value={money(tax, currency)} />}
                </>
              )}
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <dt>Total{hasCharges && <span className="font-normal text-muted-foreground"> (estimate)</span>}</dt>
                <dd className="tabular-nums">{money(total, currency)}</dd>
              </div>
            </dl>

            {needsDetails && (
              <div className="rounded-2xl border bg-muted/40 p-4">
                <GuestDetails guest={guest} onChange={onGuest} />
              </div>
            )}
          </div>

          <DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
            {error && (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button size="xl" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {busy ? 'Placing your order…' : `Place order · ${money(total, currency)}`}
            </Button>
            <p className="text-center text-xs text-muted-foreground">Pay at the counter or ask for the bill when you&apos;re done.</p>
          </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}
