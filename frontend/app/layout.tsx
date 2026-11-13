import type { Metadata, Viewport } from 'next'
import { DM_Sans, Fraunces } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import './globals.css'

const sans = DM_Sans({ subsets: ['latin'], variable: '--font-sans' })
// Headings: a warm serif, like a printed café menu.
const display = Fraunces({ subsets: ['latin'], style: ['normal', 'italic'], variable: '--font-display' })

export const metadata: Metadata = {
  title: 'CafeFlow',
  description: 'Order from your table',
  // Table links are private (anyone with one can order at that table), so keep the site out of search engines.
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Lets the bottom bars sit above the iPhone home indicator (env(safe-area-inset-bottom)).
  viewportFit: 'cover',
  themeColor: '#f6efe4',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn('font-sans', sans.variable, display.variable)}>
      <body>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  )
}
