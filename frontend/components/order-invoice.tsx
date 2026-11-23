import { BrandMark } from '@/components/brand-mark'
import { imageSrc, money } from '@/lib/api'
import type { Order, Restaurant } from '@/app/admin/types'

export default function OrderInvoice({ order, restaurant }: { order: Order; restaurant: Restaurant }) {
  const issued = new Date(order.created_at).toLocaleString()
  const logo = imageSrc(restaurant.logo_url)
  const taxLabel = order.tax_label ?? 'Tax'

  return (
    <article
      id="invoice-print-root"
      className="invoice-paper mx-auto w-full max-w-[210mm] overflow-hidden rounded-xl border bg-white text-slate-950 shadow-sm"
    >
      <header className="flex flex-col gap-5 border-b-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-9" style={{ borderColor: restaurant.accent_color }}>
        <div className="flex min-w-0 items-center gap-4">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={`${restaurant.name} logo`} className="size-16 shrink-0 rounded-lg object-contain" />
          ) : (
            <BrandMark name={restaurant.name} className="size-16 shrink-0 rounded-lg text-2xl" />
          )}
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold leading-tight">{restaurant.name}</h1>
            <p className="mt-1 text-sm text-slate-600">Restaurant invoice</p>
          </div>
        </div>
        <dl className="grid shrink-0 grid-cols-[auto_auto] gap-x-5 gap-y-1 text-sm sm:text-right">
          <dt className="text-slate-500">Invoice</dt>
          <dd className="font-semibold">{order.reference}</dd>
          <dt className="text-slate-500">Date</dt>
          <dd>{issued}</dd>
        </dl>
      </header>

      <section className="grid gap-6 border-b p-6 sm:grid-cols-2 sm:p-9">
        <div>
          <h2 className="text-xs font-semibold tracking-widest text-slate-500 uppercase">Billed to</h2>
          <p className="mt-2 font-semibold">{order.customer_name}</p>
          <p className="mt-1 text-sm text-slate-600">{order.customer_phone}</p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-2 text-sm sm:justify-self-end">
          <dt className="text-slate-500">Table</dt>
          <dd className="font-medium">{order.table_name}</dd>
          <dt className="text-slate-500">Order</dt>
          <dd className="font-medium">#{order.reference}</dd>
          <dt className="text-slate-500">Order time</dt>
          <dd>{issued}</dd>
        </dl>
      </section>

      <section className="p-4 sm:p-9">
        <div className="invoice-items-wrapper overflow-x-auto">
          <table className="invoice-items w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 text-xs tracking-wide text-slate-500 uppercase">
                <th scope="col" className="w-12 py-3 pr-2">Sl.</th>
                <th scope="col" className="py-3 pr-3">Item</th>
                <th scope="col" className="w-16 py-3 px-2 text-right">Qty</th>
                <th scope="col" className="w-28 py-3 px-2 text-right">Unit price</th>
                <th scope="col" className="w-28 py-3 pl-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => (
                <tr key={`${item.name}-${index}`} className="border-b border-slate-200">
                  <td className="py-3 pr-2 text-slate-500">{index + 1}</td>
                  <td className="py-3 pr-3 font-medium break-words">{item.name}</td>
                  <td className="py-3 px-2 text-right tabular-nums">{item.quantity}</td>
                  <td className="py-3 px-2 text-right tabular-nums">{money(item.unit_price, restaurant.currency)}</td>
                  <td className="py-3 pl-2 text-right tabular-nums">{money(item.line_total, restaurant.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="ml-auto mt-6 w-full max-w-sm space-y-2 text-sm">
          <SummaryLine label="Subtotal" amount={money(order.subtotal, restaurant.currency)} />
          {order.service_charge > 0 && (
            <SummaryLine
              label={`Service charge${order.service_charge_percent === null ? '' : ` (${order.service_charge_percent}%)`}`}
              amount={money(order.service_charge, restaurant.currency)}
            />
          )}
          {order.tax > 0 && (
            <SummaryLine
              label={`${taxLabel}${order.tax_percent === null ? '' : ` (${order.tax_percent}%)`}`}
              amount={money(order.tax, restaurant.currency)}
            />
          )}
          <div className="flex justify-between border-t-2 pt-3 text-base font-bold">
            <dt>Grand total</dt>
            <dd className="tabular-nums">{money(order.total, restaurant.currency)}</dd>
          </div>
        </dl>
      </section>

      <footer className="border-t bg-slate-50 px-6 py-5 text-center sm:px-9">
        <p className="font-medium" style={{ color: restaurant.accent_color }}>Thank you for dining with us.</p>
        <p className="mt-1 text-xs text-slate-500">{restaurant.name}</p>
      </footer>
    </article>
  )
}

function SummaryLine({ label, amount }: { label: string; amount: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-600">{label}</dt>
      <dd className="shrink-0 tabular-nums">{amount}</dd>
    </div>
  )
}
