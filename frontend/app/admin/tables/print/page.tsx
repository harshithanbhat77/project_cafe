'use client'
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import QRCode from 'qrcode'
import { useAdmin } from '../../admin-context'
import type { Table } from '../../types'

type Card = { table: Table; qrImage: string }

/** Printable QR cards: all active tables, or one table with ?id=. */
export default function PrintQrPage() {
  // useSearchParams needs a Suspense boundary in Next.js.
  return (
    <Suspense>
      <PrintQrCards />
    </Suspense>
  )
}

function PrintQrCards() {
  const { call } = useAdmin()
  const [cards, setCards] = useState<Card[]>([])
  const [error, setError] = useState('')
  const id = useSearchParams().get('id')
  const onlyId = id ? Number(id) : null

  useEffect(() => {
    async function load() {
      try {
        const tables = await call<Table[]>('/api/admin/tables')
        const chosen = tables.filter((t) => (onlyId ? t.id === onlyId : t.active))
        // The QR points at this same site, so it works for whatever domain the dashboard is on.
        const made = await Promise.all(
          chosen.map(async (table) => ({
            table,
            qrImage: await QRCode.toDataURL(`${window.location.origin}/order/${table.qr_token}`, {
              margin: 1,
              width: 440,
            }),
          })),
        )
        setCards(made)
      } catch (e) {
        setError((e as Error).message)
      }
    }
    load()
  }, [call, onlyId])

  return (
    <>
      <div className="actions no-print">
        <button className="primary" onClick={() => window.print()} disabled={cards.length === 0}>
          Print
        </button>
        <Link className="pill" href="/admin/tables">
          Back to tables
        </Link>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="qr-grid">
        {cards.map(({ table, qrImage }) => (
          <div className="qr-card" key={table.id}>
            <div className="brand">
              cafe<span>flow</span>
            </div>
            <h2>{table.name}</h2>
            <img src={qrImage} alt={`QR code for ${table.name}`} />
            <p>Scan to see the menu and order</p>
          </div>
        ))}
      </div>
    </>
  )
}
