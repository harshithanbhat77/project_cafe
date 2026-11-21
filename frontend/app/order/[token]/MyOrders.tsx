import { CheckCircle2, ChefHat, Clock, Plus, Utensils, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { money } from '@/lib/api'
import { cn } from '@/lib/utils'
import { HelpTrigger } from './HelpDrawer'
import type { Order, OrderStatus } from './types'

const STATUS: Record<OrderStatus, { text: string; icon: LucideIcon; tone: string }> = {
  PLACED: { text: 'Waiting for the cafe to confirm', icon: Clock, tone: 'bg-amber-50 text-amber-800 border-amber-200' },
  ACCEPTED: { text: 'Confirmed', icon: CheckCircle2, tone: 'bg-sky-50 text-sky-800 border-sky-200' },
  PREPARING: { text: 'Being prepared', icon: ChefHat, tone: 'bg-violet-50 text-violet-800 border-violet-200' },
  READY: { text: 'Ready, on its way', icon: Utensils, tone: 'bg-green-50 text-green-800 border-green-200' },
  COMPLETED: { text: 'Served', icon: CheckCircle2, tone: 'bg-muted text-muted-foreground border-border' },
  CANCELLED: { text: 'Cancelled, please ask staff', icon: XCircle, tone: 'bg-red-50 text-red-700 border-red-200' },
}

export default function MyOrders({
  orders,
  currency,
  taxLabel,
  onOrderMore,
  helpPending,
  onHelp,
}: {
  orders: Order[]
  currency: string
  taxLabel: string
  onOrderMore: () => void
  helpPending: boolean
  onHelp: () => void
}) {
  return (
    <div className="mx-auto w-full max-w-lg px-4 pt-5 pb-28">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Your orders</h1>
          <p className="text-muted-foreground">Updates by itself. We&apos;ll bring everything to your table.</p>
        </div>
      </div>

      <div className="space-y-4">
        {orders.map((o) => {
          const status = STATUS[o.status]
          const Icon = status.icon
          const time = new Date(o.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
          return (
            <article key={o.id} className="overflow-hidden rounded-xl border bg-card">
              <div className={cn('flex items-center gap-2 border-b px-4 py-3 text-sm font-medium', status.tone)}>
                <Icon className="size-4 shrink-0" />
                <span className="flex-1">{status.text}</span>
                {['PLACED', 'ACCEPTED', 'PREPARING'].includes(o.status) && (
                  <span className="relative flex size-2.5" aria-hidden>
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-50" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-current" />
                  </span>
                )}
              </div>
              <div className="space-y-3 p-4">
                <div className="flex items-baseline justify-between text-sm text-muted-foreground">
                  <span className="font-heading text-lg font-semibold text-foreground">Order #{o.reference}</span>
                  <span>{time}</span>
                </div>
                <ul className="space-y-1.5">
                  {o.items.map((i) => (
                    <li key={i.name} className="flex justify-between gap-4">
                      <span>
                        <span className="font-medium tabular-nums">{i.quantity}×</span> {i.name}
                      </span>
                      <span className="tabular-nums">{money(i.line_total, currency)}</span>
                    </li>
                  ))}
                </ul>
                {o.notes && (
                  <p className="rounded-lg bg-muted px-3 py-2 text-sm">
                    <span className="font-medium">Note:</span> {o.notes}
                  </p>
                )}
                <dl className="space-y-1 border-t border-dashed pt-3 text-sm">
                  {o.service_charge > 0 && <Line label="Service charge" value={money(o.service_charge, currency)} />}
                  {o.tax > 0 && <Line label={taxLabel} value={money(o.tax, currency)} />}
                  <div className="flex justify-between text-base font-semibold">
                    <dt>Total</dt>
                    <dd className="tabular-nums">{money(o.total, currency)}</dd>
                  </div>
                </dl>
              </div>
            </article>
          )
        })}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-lg gap-2">
          <HelpTrigger pending={helpPending} onClick={onHelp} className="h-12" />
          <Button size="xl" className="flex-1" onClick={onOrderMore}>
            <Plus /> Order more
          </Button>
        </div>
      </div>
    </div>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}
