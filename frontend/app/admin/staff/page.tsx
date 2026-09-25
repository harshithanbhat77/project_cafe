'use client'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useAdmin } from '../admin-context'
import type { Role, User } from '../types'

const MIN_PASSWORD = 12

export default function StaffPage() {
  const { call, isOwner, me } = useAdmin()
  const [users, setUsers] = useState<User[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState({ name: '', email: '', role: 'STAFF' as Role, password: '' })
  const [resetting, setResetting] = useState<{ id: number; password: string } | null>(null)

  const load = useCallback(async () => {
    try {
      setUsers(await call<User[]>('/api/admin/users'))
    } catch (e) {
      setError((e as Error).message)
    }
  }, [call])

  useEffect(() => {
    if (isOwner) load()
  }, [isOwner, load])

  async function run(action: () => Promise<unknown>, success = ''): Promise<boolean> {
    setError('')
    setNotice('')
    try {
      await action()
      setNotice(success)
      await load()
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    }
  }

  async function addUser(e: FormEvent) {
    e.preventDefault()
    const added = await run(
      () => call('/api/admin/users', { method: 'POST', body: form }),
      `${form.name} can now sign in with ${form.email.trim().toLowerCase()}.`,
    )
    if (added) setForm({ name: '', email: '', role: 'STAFF', password: '' })
  }

  const update = (user: User, body: Partial<User>, success = '') =>
    run(() => call(`/api/admin/users/${user.id}`, { method: 'PATCH', body }), success)

  async function resetPassword(e: FormEvent) {
    e.preventDefault()
    if (!resetting) return
    const user = users.find((u) => u.id === resetting.id)
    const done = await run(
      () => call(`/api/admin/users/${resetting.id}`, { method: 'PATCH', body: { password: resetting.password } }),
      `Password changed for ${user?.name}.`,
    )
    if (done) setResetting(null)
  }

  if (!isOwner)
    return (
      <div className="panel">
        <p>Only the owner can manage staff accounts.</p>
      </div>
    )

  return (
    <>
      <div className="panel">
        <h2>Staff</h2>
        <p className="muted">
          Staff can handle orders, mark items sold out and clear tables. Owners can also change the menu, tables and
          staff. Deactivating someone signs them out straight away.
        </p>
        {error && <div className="error">{error}</div>}
        {notice && <p className="muted">{notice}</p>}

        {users.map((user) => {
          const isMe = user.id === me?.id
          return (
            <div className="row" key={user.id}>
              <div>
                <strong>{user.name}</strong>
                {isMe && ' (you)'}
                <span className="tag">{user.role === 'OWNER' ? 'Owner' : 'Staff'}</span>
                {!user.active && <span className="tag warn">Deactivated</span>}
                <div className="muted">{user.email}</div>
                {resetting?.id === user.id && (
                  <form className="inline-form" onSubmit={resetPassword}>
                    <input
                      className="input"
                      type="password"
                      autoComplete="new-password"
                      placeholder={`New password (min ${MIN_PASSWORD} characters)`}
                      value={resetting.password}
                      onChange={(e) => setResetting({ id: user.id, password: e.target.value })}
                      minLength={MIN_PASSWORD}
                      required
                      autoFocus
                    />
                    <button>Save</button>
                    <button type="button" onClick={() => setResetting(null)}>
                      Cancel
                    </button>
                  </form>
                )}
              </div>
              <div className="actions">
                <button onClick={() => setResetting({ id: user.id, password: '' })}>Reset password</button>
                {!isMe && (
                  <>
                    <button onClick={() => update(user, { role: user.role === 'OWNER' ? 'STAFF' : 'OWNER' })}>
                      {user.role === 'OWNER' ? 'Make staff' : 'Make owner'}
                    </button>
                    <button onClick={() => update(user, { active: !user.active })}>
                      {user.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <form className="panel form-grid" onSubmit={addUser}>
        <h3 className="wide" style={{ marginTop: 0 }}>
          Add someone
        </h3>
        <label>
          Name
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            maxLength={120}
          />
        </label>
        <label>
          Email
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </label>
        <label>
          Role
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            <option value="STAFF">Staff</option>
            <option value="OWNER">Owner</option>
          </select>
        </label>
        <label>
          First password (they can ask you to reset it)
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            minLength={MIN_PASSWORD}
            required
          />
        </label>
        <div className="actions wide">
          <button className="primary">Add</button>
        </div>
      </form>
    </>
  )
}
