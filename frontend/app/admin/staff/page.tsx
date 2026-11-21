'use client'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import { KeyRound, Loader2, MoreHorizontal, ShieldCheck, ShieldOff, UserCheck, UserPlus, UserX, UsersRound } from 'lucide-react'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useAdmin } from '../admin-context'
import type { Role, User } from '../types'
import { EmptyState, ErrorBanner, PageHeader } from '../ui'

const MIN_PASSWORD = 12

export default function StaffPage() {
  const { call, isOwner, me } = useAdmin()
  const [confirm, confirmDialog] = useConfirm()
  const [users, setUsers] = useState<User[] | null>(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [resetting, setResetting] = useState<User | null>(null)

  const load = useCallback(async () => {
    try {
      setUsers(await call<User[]>('/api/admin/users'))
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }, [call])

  useEffect(() => {
    if (isOwner) load()
  }, [isOwner, load])

  async function update(user: User, body: Partial<User>, success: string) {
    try {
      await call(`/api/admin/users/${user.id}`, { method: 'PATCH', body })
      toast.success(success)
      load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function deactivate(user: User) {
    const ok = await confirm({
      title: `Deactivate ${user.name}?`,
      description: 'They are signed out straight away and can’t sign in again until you reactivate them.',
      confirmLabel: 'Deactivate',
      destructive: true,
    })
    if (ok) update(user, { active: false }, `${user.name} has been deactivated`)
  }

  async function changeRole(user: User) {
    const toOwner = user.role !== 'OWNER'
    const ok = await confirm({
      title: toOwner ? `Make ${user.name} an owner?` : `Make ${user.name} staff?`,
      description: toOwner
        ? 'Owners can change the menu, prices, tables, settings and staff accounts.'
        : 'They will only be able to run service: orders, sold-out dishes and clearing tables.',
      confirmLabel: toOwner ? 'Make owner' : 'Make staff',
    })
    if (ok) update(user, { role: toOwner ? 'OWNER' : 'STAFF' }, `${user.name} is now ${toOwner ? 'an owner' : 'staff'}`)
  }

  if (!isOwner)
    return <EmptyState icon={ShieldOff} title="Only the owner can manage staff accounts" className="mt-10" />

  return (
    <>
      {confirmDialog}
      <PageHeader
        title="Staff"
        description="Staff can handle orders, mark dishes sold out and clear tables. Owners can also change the menu, tables, settings and staff."
        actions={
          <Button size="lg" onClick={() => setAdding(true)}>
            <UserPlus /> Add person
          </Button>
        }
      />
      <ErrorBanner message={error} />

      {users === null ? (
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      ) : users.length === 0 ? (
        <EmptyState icon={UsersRound} title="No accounts yet" />
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {users.map((user) => {
            const isMe = user.id === me?.id
            return (
              <li key={user.id} className={cn('flex items-center gap-4 px-4 py-3', !user.active && 'bg-muted/40')}>
                <span
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                    user.active ? 'bg-brand-soft text-primary' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {initials(user.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate font-medium', !user.active && 'text-muted-foreground')}>
                    {user.name}
                    {isMe && <span className="font-normal text-muted-foreground"> (you)</span>}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                </div>
                <div className="hidden items-center gap-2 sm:flex">
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs font-medium',
                      user.role === 'OWNER' ? 'bg-foreground text-background' : 'bg-muted text-foreground',
                    )}
                  >
                    {user.role === 'OWNER' ? 'Owner' : 'Staff'}
                  </span>
                  {!user.active && (
                    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">Deactivated</span>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-lg" aria-label={`Options for ${user.name}`}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onSelect={() => setResetting(user)}>
                      <KeyRound /> Reset password
                    </DropdownMenuItem>
                    {!isMe && (
                      <>
                        <DropdownMenuItem onSelect={() => changeRole(user)}>
                          <ShieldCheck /> {user.role === 'OWNER' ? 'Make staff' : 'Make owner'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {user.active ? (
                          <DropdownMenuItem variant="destructive" onSelect={() => deactivate(user)}>
                            <UserX /> Deactivate
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onSelect={() => update(user, { active: true }, `${user.name} can sign in again`)}>
                            <UserCheck /> Reactivate
                          </DropdownMenuItem>
                        )}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            )
          })}
        </ul>
      )}

      <AddPersonDialog
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={() => {
          setAdding(false)
          load()
        }}
      />
      <ResetPasswordDialog key={resetting?.id ?? 'closed'} user={resetting} onClose={() => setResetting(null)} />
    </>
  )
}

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function AddPersonDialog({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const { call } = useAdmin()
  const empty = { name: '', email: '', role: 'STAFF' as Role, password: '' }
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await call('/api/admin/users', { method: 'POST', body: form })
      toast.success(`${form.name} can now sign in with ${form.email.trim().toLowerCase()}`)
      setForm(empty)
      onAdded()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add someone</DialogTitle>
            <DialogDescription>They sign in at this dashboard with their email and the password you set.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="person-name">Name</Label>
            <Input id="person-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={120} autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="person-email">Email</Label>
            <Input id="person-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
              <SelectTrigger className="w-full" aria-label="Role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STAFF">Staff: runs service</SelectItem>
                <SelectItem value="OWNER">Owner: full access</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="person-password">First password</Label>
            <Input
              id="person-password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              minLength={MIN_PASSWORD}
              required
            />
            <p className="text-xs text-muted-foreground">At least {MIN_PASSWORD} characters. You can reset it later.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              Add person
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { call } = useAdmin()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setBusy(true)
    try {
      await call(`/api/admin/users/${user.id}`, { method: 'PATCH', body: { password } })
      toast.success(`Password changed for ${user.name}`)
      onClose()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={user !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Reset password for {user?.name}</DialogTitle>
            <DialogDescription>Tell them the new password in person. It works straight away.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={MIN_PASSWORD}
              required
              autoFocus
            />
            <p className="text-xs text-muted-foreground">At least {MIN_PASSWORD} characters.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              Change password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
