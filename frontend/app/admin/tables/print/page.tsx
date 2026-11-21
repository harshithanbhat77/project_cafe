'use client'
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import QRCode from 'qrcode'
import { ArrowLeft, Printer, ScanLine } from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { Button } from '@/components/ui/button'
import { guestUrl } from '@/lib/tables'
import { useAdmin } from '../../admin-context'
import type { Table } from '../../types'
import { ErrorBanner, PageHeader } from '../../ui'

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
  const { call, brand } = useAdmin()
  const [cards, setCards] = useState<Card[] | null>(null)
  const [error, setError] = useState('')
  const id = useSearchParams().get('id')
  const onlyId = id ? Number(id) : null
  const name = brand?.name ?? ''

  useEffect(() => {
    async function load() {
      try {
        const tables = await call<Table[]>('/api/admin/tables')
        const chosen = tables.filter((t) => (onlyId ? t.id === onlyId : t.active))
        const made = await Promise.all(
          chosen.map(async (table) => ({
            table,
            qrImage: await QRCode.toDataURL(guestUrl(table), { margin: 1, width: 600, errorCorrectionLevel: 'M' }),
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
      <div className="print:hidden">
        <PageHeader
          title={cards?.length === 1 ? `QR code for ${cards[0].table.name}` : 'Print QR codes'}
          description="Print on card, cut along the edges, and place one on each table. Each code opens the menu for that table."
          actions={
            <>
              <Button variant="outline" size="lg" asChild>
                <Link href="/admin/tables">
                  <ArrowLeft /> Back to tables
                </Link>
              </Button>
              <Button size="lg" onClick={() => window.print()} disabled={!cards?.length}>
                <Printer /> Print
              </Button>
            </>
          }
        />
        <ErrorBanner message={error} />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 print:grid-cols-2 print:gap-4">
        {cards === null
          ? [0, 1, 2].map((i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-muted" />)
          : cards.map(({ table, qrImage }) => (
              <div
                key={table.id}
                className="flex break-inside-avoid flex-col items-center rounded-2xl border-2 border-dashed border-border bg-paper p-6 text-center text-ink print:rounded-none print:[print-color-adjust:exact]"
              >
                <div className="flex items-center gap-2">
                  <BrandMark name={name} logoUrl={brand?.logo_url} className="size-8 rounded-lg text-sm print:[print-color-adjust:exact]" />
                  <span className="font-heading text-lg italic">{name}</span>
                </div>
                <p className="mt-4 font-heading text-4xl font-semibold">{table.name}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrImage} alt={`QR code for ${table.name}`} className="my-4 w-full max-w-56" />
                <p className="flex items-center gap-2 font-medium">
                  <ScanLine className="size-5" /> Scan to see the menu and order
                </p>
                <p className="mt-1 text-sm text-muted-foreground">No app needed. Your order comes to this table.</p>
              </div>
            ))}
      </div>
    </>
  )
}
