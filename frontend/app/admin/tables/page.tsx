'use client'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Brush,
  ClipboardList,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Printer,
  QrCode,
  ReceiptText,
  RefreshCw,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useAdmin } from '../admin-context'
import type { Table, TableStatus } from '../types'
import { EmptyState, ErrorBanner, PageHeader } from '../ui'

const POLL_MS = 10000

/** Free, seated, or needing attention: drives the card's color and wording. */
function tableState(t: TableStatus): 'disabled' | 'needs-attention' | 'seated' | 'free' {
  if (!t.active) return 'disabled'
  if (t.open_requests.length > 0) return 'needs-attention'
  if (t.guests > 0 || t.open_orders > 0) return 'seated'
  return 'free'
}

export default function TablesPage() {
  const { call, isOwner } = useAdmin()
  const [confirm, confirmDialog] = useConfirm()
  const [tables, setTables] = useState<TableStatus[] | null>(null)
  const [error, setError] = useState('')
  const [nameDialog, setNameDialog] = useState<Table | 'new' | null>(null)

  const load = useCallback(async () => {
    try {
      setTables(await call<TableStatus[]>('/api/admin/tables'))
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }, [call])

  // Kept live, so staff can see which tables are busy or waiting.
  useEffect(() => {
    load()
    const timer = setInterval(load, POLL_MS)
    return () => clearInterval(timer)
  }, [load])

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action()
      toast.success(success)
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function clear(table: TableStatus) {
    const ok = await confirm({
      title: `Clear ${table.name}?`,
      description: (
        <>
          Use this when guests leave. Anyone still at the table will need to enter their details again to order.
          {table.open_orders > 0 && (
            <span className="mt-2 block font-medium text-foreground">
              {table.open_orders} {table.open_orders === 1 ? 'order is' : 'orders are'} still open. They stay on the
              Orders screen.
            </span>
          )}
        </>
      ),
      confirmLabel: 'Clear table',
    })
    if (ok) run(() => call(`/api/admin/tables/${table.id}/clear`, { method: 'POST' }), `${table.name} is ready for the next guests`)
  }

  async function rotate(table: Table) {
    const ok = await confirm({
      title: `Make a new QR code for ${table.name}?`,
      description:
        'The QR code currently on the table will stop working straight away, so print the new one and replace it. Use this if the old code was shared or photographed.',
      confirmLabel: 'Make new QR code',
      destructive: true,
    })
    if (ok)
      run(
        () => call(`/api/admin/tables/${table.id}/rotate-token`, { method: 'POST' }),
        `New QR code made for ${table.name}. Print it and replace the old one.`,
      )
  }

  const toggleActive = (table: Table) =>
    run(
      () => call(`/api/admin/tables/${table.id}`, { method: 'PATCH', body: { active: !table.active } }),
      table.active ? `${table.name} is disabled` : `${table.name} is enabled`,
    )

  return (
    <>
      {confirmDialog}
      <PageHeader
        title="Tables"
        description={
          <>
            Clear a table when guests leave, so the next guests start fresh.
            {isOwner && ' Make a new QR code if an old one has been shared or photographed.'}
          </>
        }
        actions={
          <>
            <Button variant="outline" size="lg" asChild>
              <Link href="/admin/tables/print">
                <Printer /> Print all QR codes
              </Link>
            </Button>
            {isOwner && (
              <Button size="lg" onClick={() => setNameDialog('new')}>
                <Plus /> Add table
              </Button>
            )}
          </>
        }
      />
      <ErrorBanner message={error} />

      {tables === null ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : tables.length === 0 ? (
        <EmptyState icon={QrCode} title="No tables yet">
          {isOwner ? 'Add your tables, then print a QR code for each one.' : 'The owner hasn’t added any tables yet.'}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tables.map((table) => (
            <article
              key={table.id}
              className={cn(
                'flex flex-col rounded-2xl border bg-card p-4',
                tableState(table) === 'disabled' && 'bg-muted/40',
                tableState(table) === 'needs-attention' && 'border-primary bg-brand-soft',
              )}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-2xl font-semibold">{table.name}</h2>
                  <TableStateLabel table={table} />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-lg" className="-mt-1 -mr-2" aria-label={`${table.name} options`}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem asChild>
                      <Link href={`/admin/tables/print?id=${table.id}`}>
                        <Printer /> Print QR code
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href={`/order/${table.qr_token}`} target="_blank" rel="noreferrer">
                        <ExternalLink /> Open guest page
                      </a>
                    </DropdownMenuItem>
                    {isOwner && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => setNameDialog(table)}>
                          <Pencil /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => toggleActive(table)}>
                          <Power /> {table.active ? 'Disable table' : 'Enable table'}
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onSelect={() => rotate(table)}>
                          <RefreshCw /> Make new QR code
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <ul className="my-4 space-y-1.5 text-sm">
                {table.open_requests.map((kind) => (
                  <li key={kind} className="flex items-center gap-2 font-semibold text-primary">
                    {kind === 'BILL' ? <ReceiptText className="size-4" /> : <UserRound className="size-4" />}
                    {kind === 'BILL' ? 'Wants the bill' : 'Asking for a waiter'}
                  </li>
                ))}
                {table.guests > 0 && (
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <UsersRound className="size-4" />
                    {table.guests} {table.guests === 1 ? 'guest' : 'guests'} at the table
                  </li>
                )}
                {table.open_orders > 0 && (
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <ClipboardList className="size-4" />
                    {table.open_orders} open {table.open_orders === 1 ? 'order' : 'orders'}
                  </li>
                )}
              </ul>

              {(tableState(table) === 'seated' || tableState(table) === 'needs-attention') && (
                <Button variant="outline" size="lg" className="mt-auto w-full bg-card" onClick={() => clear(table)}>
                  <Brush /> Clear table
                </Button>
              )}
            </article>
          ))}
        </div>
      )}

      <TableNameDialog
        key={nameDialog === 'new' ? 'new' : nameDialog?.id ?? 'closed'}
        table={nameDialog}
        onClose={() => setNameDialog(null)}
        onSaved={() => {
          setNameDialog(null)
          load()
        }}
      />
    </>
  )
}

function TableStateLabel({ table }: { table: TableStatus }) {
  const state = tableState(table)
  const label = { disabled: 'Disabled', 'needs-attention': 'Needs attention', seated: 'Guests seated', free: 'Free' }[state]
  return (
    <span
      className={cn(
        'mt-1 inline-flex items-center gap-1.5 text-sm font-medium',
        state === 'free' && 'text-green-700',
        state === 'seated' && 'text-sky-700',
        state === 'needs-attention' && 'text-primary',
        state === 'disabled' && 'text-muted-foreground',
      )}
    >
      <span
        className={cn(
          'size-2 rounded-full bg-current',
          state === 'needs-attention' && 'animate-pulse',
        )}
      />
      {label}
    </span>
  )
}

function TableNameDialog({
  table,
  onClose,
  onSaved,
}: {
  table: Table | 'new' | null
  onClose: () => void
  onSaved: () => void
}) {
  const { call } = useAdmin()
  const existing = table && table !== 'new' ? table : null
  const [name, setName] = useState(existing?.name ?? '')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      if (existing) await call(`/api/admin/tables/${existing.id}`, { method: 'PATCH', body: { name: name.trim() } })
      else await call('/api/admin/tables', { method: 'POST', body: { name: name.trim() } })
      toast.success(existing ? 'Table renamed' : `${name.trim()} added. Print its QR code next.`)
      onSaved()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={table !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{existing ? `Rename ${existing.name}` : 'Add a table'}</DialogTitle>
            <DialogDescription>Guests see this name when they scan the QR code.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="table-name">Table name</Label>
            <Input
              id="table-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Table 8 or Patio 3"
              required
              maxLength={80}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {existing ? 'Save' : 'Add table'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
