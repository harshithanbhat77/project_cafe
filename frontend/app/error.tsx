'use client'
import { useEffect } from 'react'
import { RotateCcw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Shown if a page crashes, instead of a blank screen. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-destructive/10">
          <TriangleAlert className="size-7 text-destructive" />
        </span>
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-muted-foreground">Please try again. If it keeps happening, ask a member of staff.</p>
        <Button className="mt-6" onClick={reset}>
          <RotateCcw /> Try again
        </Button>
      </div>
    </main>
  )
}
