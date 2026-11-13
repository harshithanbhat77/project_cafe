'use client'
import { useState } from 'react'
import { BellRing, CheckCircle2, ChevronRight, Loader2, ReceiptText, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { cn } from '@/lib/utils'
import GuestDetails, { type Guest } from './GuestDetails'
import type { ServiceRequest } from './types'

type Kind = ServiceRequest['kind']

const OPTIONS: { kind: Kind; icon: LucideIcon; title: string; detail: string; done: string }[] = [
  { kind: 'WAITER', icon: UserRound, title: 'Call a waiter', detail: 'Someone will come to your table', done: 'A waiter is on the way' },
  { kind: 'BILL', icon: ReceiptText, title: 'Ask for the bill', detail: 'We’ll bring it to your table', done: 'Your bill is on the way' },
]

/** The button that opens the help drawer. Shows when staff have been told. */
export function HelpTrigger({
  pending,
  onClick,
  className,
  compact = false,
}: {
  pending: boolean
  onClick: () => void
  className?: string
  compact?: boolean
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className={cn('h-11 rounded-xl bg-card', pending && 'border-green-300 text-green-700', className)}
      aria-label={pending ? 'Staff have been notified' : 'Call a waiter or ask for the bill'}
    >
      {pending ? <CheckCircle2 className="size-5" /> : <BellRing className="size-5" />}
      <span className={cn(compact && 'sr-only sm:not-sr-only')}>{pending ? 'Staff notified' : 'Need help?'}</span>
    </Button>
  )
}

/** Call a waiter or ask for the bill. Asks for the guest's details first if they haven't ordered yet. */
export default function HelpDrawer({
  open,
  onOpenChange,
  requests,
  needsDetails,
  guest,
  onGuest,
  onRequest,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  requests: ServiceRequest[]
  needsDetails: boolean
  guest: Guest
  onGuest: (guest: Guest) => void
  onRequest: (kind: Kind) => Promise<boolean>
}) {
  const [sending, setSending] = useState<Kind | null>(null)

  async function send(kind: Kind) {
    setSending(kind)
    const ok = await onRequest(kind)
    setSending(null)
    if (ok) onOpenChange(false)
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-lg">
        <DrawerHeader>
          <DrawerTitle className="text-xl">How can we help?</DrawerTitle>
          <DrawerDescription>We&apos;ll let the staff know straight away.</DrawerDescription>
        </DrawerHeader>
        <div className="space-y-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {needsDetails && (
            <div className="mb-2 rounded-2xl border bg-muted/40 p-4">
              <GuestDetails guest={guest} onChange={onGuest} />
            </div>
          )}
          {OPTIONS.map(({ kind, icon: Icon, title, detail, done }) => {
            const pending = requests.some((r) => r.kind === kind)
            return (
              <button
                key={kind}
                type="button"
                disabled={pending || sending !== null}
                onClick={() => send(kind)}
                className={cn(
                  'flex w-full items-center gap-4 rounded-2xl border bg-card p-4 text-left transition-colors hover:bg-muted disabled:cursor-default',
                  pending && 'border-green-200 bg-green-50 hover:bg-green-50',
                )}
              >
                <span
                  className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-primary',
                    pending && 'bg-green-100 text-green-700',
                  )}
                >
                  {sending === kind ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : pending ? (
                    <CheckCircle2 className="size-5" />
                  ) : (
                    <Icon className="size-5" />
                  )}
                </span>
                <span className="flex-1">
                  <span className="block font-semibold">{pending ? done : title}</span>
                  <span className="block text-sm text-muted-foreground">{pending ? 'We’ve told the staff' : detail}</span>
                </span>
                {!pending && <ChevronRight className="size-5 text-muted-foreground" />}
              </button>
            )
          })}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
