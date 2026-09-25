'use client'
import { FormEvent, ReactNode, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AdminProvider, useAdmin } from './admin-context'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminProvider>
      <AdminShell>{children}</AdminShell>
    </AdminProvider>
  )
}

const TABS = [
  { href: '/admin', label: 'Orders', ownerOnly: false },
  { href: '/admin/menu', label: 'Menu', ownerOnly: false },
  { href: '/admin/tables', label: 'Tables', ownerOnly: false },
  { href: '/admin/staff', label: 'Staff', ownerOnly: true },
]

function AdminShell({ children }: { children: ReactNode }) {
  const { token, me, isOwner, logout } = useAdmin()
  const pathname = usePathname()

  if (token === undefined) return null
  if (!token) return <LoginForm />
  if (!me)
    return (
      <main className="shell">
        <p>Loading...</p>
      </main>
    )

  return (
    <main className="shell">
      <div className="topbar no-print">
        <div className="brand">
          cafe<span>flow</span>
        </div>
        <div className="actions" style={{ marginTop: 0, alignItems: 'center' }}>
          <span className="muted">
            {me.name} · {isOwner ? 'Owner' : 'Staff'}
          </span>
          <button className="pill" onClick={() => logout()}>
            Sign out
          </button>
        </div>
      </div>
      <nav className="admin-nav no-print">
        {TABS.filter((tab) => isOwner || !tab.ownerOnly).map((tab) => (
          <Link key={tab.href} href={tab.href} className={pathname === tab.href ? 'active' : ''}>
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </main>
  )
}

function LoginForm() {
  const { login, notice } = useAdmin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError((await login(email, password)) || '')
    setPassword('')
    setBusy(false)
  }

  return (
    <main className="shell">
      <form className="panel login" onSubmit={submit}>
        <div className="brand">
          cafe<span>flow</span>
        </div>
        <h1>Welcome back</h1>
        <p>Sign in to manage today’s service.</p>
        <label>Email</label>
        <input
          className="input"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <label>Password</label>
        <input
          className="input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {(error || notice) && <div className="error">{error || notice}</div>}
        <button className="primary" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Signing in...' : 'Open dashboard'}
        </button>
      </form>
    </main>
  )
}
