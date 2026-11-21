'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, QrCode } from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { Button } from '@/components/ui/button'
import { API } from '@/lib/api'
import { useBrandAccent } from '@/lib/brand'

type Brand = { name: string; logo_url: string | null; accent_color: string }

/** The site's front door. Guests normally arrive straight at their table's page from the QR code. */
export default function Home() {
  const [brand, setBrand] = useState<Brand | null>(null)
  useBrandAccent(brand ? brand.accent_color : undefined)

  useEffect(() => {
    fetch(`${API}/api/public/brand`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b: Brand | null) => {
        setBrand(b)
        if (b) document.title = b.name
      })
      .catch(() => {})
  }, [])

  const name = brand?.name ?? ''

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        {brand?.logo_url && <BrandMark name={name} logoUrl={brand.logo_url} className="mb-5 size-14 rounded-full" />}
        <h1 className="text-5xl italic">{name}</h1>
        <div className="mt-6 h-px w-16 bg-primary" />
        <p className="mt-6 flex max-w-xs items-start gap-3 text-left text-muted-foreground">
          <QrCode className="mt-0.5 size-5 shrink-0 text-primary" />
          To order, scan the QR code on your table with your phone&apos;s camera.
        </p>
      </div>
      <footer className="flex justify-center p-6">
        <Button variant="ghost" asChild>
          <Link href="/admin">
            Staff sign in <ArrowRight />
          </Link>
        </Button>
      </footer>
    </main>
  )
}
