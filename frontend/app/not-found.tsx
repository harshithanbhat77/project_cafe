import Link from 'next/link'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-muted">
          <Compass className="size-7 text-muted-foreground" />
        </span>
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="mt-2 text-muted-foreground">
          This page doesn&apos;t exist. If you&apos;re trying to order, scan the QR code on your table again.
        </p>
        <Button variant="outline" className="mt-6" asChild>
          <Link href="/">Go to the home page</Link>
        </Button>
      </div>
    </main>
  )
}
