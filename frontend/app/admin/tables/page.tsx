'use client'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAdmin } from '../admin-context'
import type { Table } from '../types'

export default function TablesPage() {
  const { call, isOwner } = useAdmin()
  const [tables, setTables] = useState<Table[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [newName, setNewName] = useState('')
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null)

  const load = useCallback(async () => {
    try {
      setTables(await call<Table[]>('/api/admin/tables'))
    } catch (e) {
      setError((e as Error).message)
    }
  }, [call])

  useEffect(() => {
    load()
  }, [load])

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

  function clear(table: Table) {
    if (!window.confirm(`Clear ${table.name}? Guests there will need to scan the QR code and enter their details again.`))
      return
    run(() => call(`/api/admin/tables/${table.id}/clear`, { method: 'POST' }), `${table.name} is cleared for the next guests.`)
  }

  function rotate(table: Table) {
    if (
      !window.confirm(
        `Make a new QR code for ${table.name}? The printed QR code on the table will stop working, so print and replace it.`,
      )
    )
      return
    run(
      () => call(`/api/admin/tables/${table.id}/rotate-token`, { method: 'POST' }),
      `New QR code made for ${table.name}. Print it and replace the old one.`,
    )
  }

  const toggleActive = (table: Table) =>
    run(() => call(`/api/admin/tables/${table.id}`, { method: 'PATCH', body: { active: !table.active } }))

  async function saveName(e: FormEvent) {
    e.preventDefault()
    if (!renaming) return
    const { id, name } = renaming
    if (await run(() => call(`/api/admin/tables/${id}`, { method: 'PATCH', body: { name } }))) setRenaming(null)
  }

  async function addTable(e: FormEvent) {
    e.preventDefault()
    if (await run(() => call('/api/admin/tables', { method: 'POST', body: { name: newName } }))) setNewName('')
  }

  return (
    <div className="panel">
      <h2>Tables</h2>
      <p className="muted">
        Clear a table when guests leave, so the next guests start fresh.
        {isOwner && ' Make a new QR code if an old one has been shared or photographed.'}
      </p>
      {error && <div className="error">{error}</div>}
      {notice && <p className="muted">{notice}</p>}

      <div className="actions" style={{ marginBottom: 12 }}>
        <Link className="pill" href="/admin/tables/print">
          Print all QR codes
        </Link>
        {isOwner && (
          <form className="inline-form" onSubmit={addTable}>
            <input
              className="input"
              placeholder="New table, e.g. Table 8"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              maxLength={80}
            />
            <button>Add table</button>
          </form>
        )}
      </div>

      {tables.map((table) => (
        <div className="row" key={table.id}>
          <div>
            {renaming?.id === table.id ? (
              <form className="inline-form" onSubmit={saveName}>
                <input
                  className="input"
                  value={renaming.name}
                  onChange={(e) => setRenaming({ id: table.id, name: e.target.value })}
                  required
                  maxLength={80}
                  autoFocus
                />
                <button>Save</button>
                <button type="button" onClick={() => setRenaming(null)}>
                  Cancel
                </button>
              </form>
            ) : (
              <strong>{table.name}</strong>
            )}
            {!table.active && <span className="tag warn">Disabled</span>}
            <div className="muted">
              <a href={`/order/${table.qr_token}`} target="_blank" rel="noreferrer">
                Open guest page
              </a>
            </div>
          </div>
          <div className="actions">
            <button onClick={() => clear(table)}>Clear table</button>
            <Link className="button-link" href={`/admin/tables/print?id=${table.id}`}>
              Print QR
            </Link>
            {isOwner && (
              <>
                <button onClick={() => setRenaming({ id: table.id, name: table.name })}>Rename</button>
                <button onClick={() => toggleActive(table)}>{table.active ? 'Disable' : 'Enable'}</button>
                <button onClick={() => rotate(table)}>New QR code</button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
