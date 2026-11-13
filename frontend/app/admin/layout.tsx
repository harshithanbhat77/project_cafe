'use client'
import { FormEvent, ReactNode, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardList, Loader2, LogOut, Menu, QrCode, Settings, UsersRound, UtensilsCrossed } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { AdminProvider, useAdmin } from './admin-context'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminProvider>
      <AdminShell>{children}</AdminShell>
    </AdminProvider>
  )
}

const NAV: { href: string; label: string; icon: LucideIcon; ownerOnly: boolean }[] = [
  { href: '/admin', label: 'Orders', icon: ClipboardList, ownerOnly: false },
  { href: '/admin/menu', label: 'Menu', icon: UtensilsCrossed, ownerOnly: false },
  { href: '/admin/tables', label: 'Tables', icon: QrCode, ownerOnly: false },
  { href: '/admin/staff', label: 'Staff', icon: UsersRound, ownerOnly: true },
  { href: '/admin/settings', label: 'Settings', icon: Settings, ownerOnly: true },
]

function AdminShell({ children }: { children: ReactNode }) {
  const { token, me, brand } = useAdmin()
  const [menuOpen, setMenuOpen] = useState(false)

  if (token === undefined) return null
  if (!token) return <LoginForm />
  if (!me) return <ShellSkeleton />

  const name = brand?.name ?? 'Dashboard'

  return (
    <div className="min-h-dvh bg-background md:grid md:grid-cols-[15rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r bg-card md:flex print:hidden">
        <Sidebar />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur md:hidden print:hidden">
        <Button variant="ghost" size="icon-lg" className="-ml-2" onClick={() => setMenuOpen(true)} aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
        <BrandMark name={name} logoUrl={brand?.logo_url} className="size-8 rounded-lg text-sm" />
        <span className="truncate font-heading text-lg italic">{name}</span>
      </header>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 gap-0 p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Sidebar onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8 print:p-0">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  )
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { me, isOwner, brand, logout } = useAdmin()
  const pathname = usePathname()
  const name = brand?.name ?? 'Dashboard'
  const initials = (me?.name ?? '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-3 border-b px-4">
        <BrandMark name={name} logoUrl={brand?.logo_url} className="size-9" />
        <div className="min-w-0">
          <p className="truncate font-heading text-lg leading-tight italic">{name}</p>
          <p className="text-xs text-muted-foreground">Dashboard</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3" aria-label="Dashboard">
        {NAV.filter((item) => isOwner || !item.ownerOnly).map(({ href, label, icon: Icon }) => {
          const active = href === '/admin' ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                active ? 'bg-brand-soft text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="size-[1.125rem]" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                {initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{me?.name}</span>
                <span className="block text-xs text-muted-foreground">{isOwner ? 'Owner' : 'Staff'}</span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <span className="block text-sm font-medium">{me?.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{me?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => logout()}>
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

function ShellSkeleton() {
  return (
    <div className="min-h-dvh bg-background md:grid md:grid-cols-[15rem_1fr]" aria-busy="true">
      <aside className="hidden border-r bg-card p-4 md:block">
        <Skeleton className="mb-8 h-9 w-40" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="mb-2 h-9 w-full" />
        ))}
      </aside>
      <div className="space-y-4 p-6 lg:p-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  )
}

function LoginForm() {
  const { login, notice, brand } = useAdmin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const name = brand?.name ?? 'CafeFlow'

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError((await login(email, password)) || '')
    setPassword('')
    setBusy(false)
  }

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-2">
      <div className="hidden bg-ink p-12 text-paper lg:flex lg:flex-col lg:justify-between">
        <p className="text-xs tracking-[0.25em] uppercase opacity-60">Staff dashboard</p>
        <div>
          <p className="font-heading text-6xl leading-none italic">{name}</p>
          <div className="mt-8 h-px w-16 bg-primary" />
          <p className="mt-6 max-w-sm text-lg opacity-70">Orders, menu and tables for today&apos;s service.</p>
        </div>
        <p className="text-sm opacity-50">Forgot your password? Ask the owner to reset it.</p>
      </div>

      <div className="flex items-center justify-center px-4 py-12">
        <form onSubmit={submit} className="w-full max-w-sm space-y-6">
          <div>
            <BrandMark name={name} logoUrl={brand?.logo_url} className="mb-6 size-12 lg:hidden" />
            <h1 className="text-[2rem] leading-tight">Sign in</h1>
            <p className="mt-1 text-muted-foreground">Use the email and password the owner set up for you.</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                className="h-11"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                className="h-11"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>
          {(error || notice) && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error || notice}
            </p>
          )}
          <Button size="xl" className="w-full" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
          <p className="text-center text-xs text-muted-foreground lg:hidden">
            Forgot your password? Ask the owner to reset it.
          </p>
        </form>
      </div>
    </div>
  )
}
