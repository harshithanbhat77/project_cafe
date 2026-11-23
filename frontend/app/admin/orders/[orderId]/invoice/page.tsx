'use client'
import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import OrderInvoice from '@/components/order-invoice'
import { useAdmin } from '@/app/admin/admin-context'
import type { Order, Restaurant } from '@/app/admin/types'
import { ErrorBanner, PageHeader } from '@/app/admin/ui'

export default function InvoicePage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params)
  const { call } = useAdmin()
  const [order, setOrder] = useState<Order | null>(null)
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const id = Number(orderId)
    if (!Number.isInteger(id) || id < 1) {
      setError('Order not found')
      return
    }

    let active = true
    Promise.all([
      call<Order>(`/api/admin/orders/${id}`),
      call<Restaurant>('/api/admin/settings'),
    ])
      .then(([loadedOrder, loadedRestaurant]) => {
        if (!active) return
        setOrder(loadedOrder)
        setRestaurant(loadedRestaurant)
        setError('')
      })
      .catch((cause: Error) => {
        if (active) setError(cause.message)
      })

    return () => {
      active = false
    }
  }, [call, orderId])

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Invoice preview"
          description="Review the stored order details, then print or save this invoice."
          actions={
            <>
              <Button variant="outline" size="lg" asChild>
                <Link href="/admin">
                  <ArrowLeft /> Back to orders
                </Link>
              </Button>
              <Button size="lg" onClick={() => window.print()} disabled={!order || !restaurant}>
                <Printer /> Print bill
              </Button>
            </>
          }
        />
        <ErrorBanner message={error} />
      </div>

      {order && restaurant ? (
        <OrderInvoice order={order} restaurant={restaurant} />
      ) : !error ? (
        <div className="mx-auto h-96 max-w-[210mm] animate-pulse rounded-xl bg-muted print:hidden" aria-label="Loading invoice" />
      ) : null}
    </>
  )
}
