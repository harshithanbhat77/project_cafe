import type { Diet } from '@/components/diet-marker'

export type Role = 'OWNER' | 'STAFF'
export type OrderStatus = 'PLACED' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED'

export type User = { id: number; name: string; email: string; role: Role; active: boolean }

export type Order = {
  id: number
  reference: string
  table_name: string
  status: OrderStatus
  notes: string | null
  subtotal: number
  service_charge: number
  tax: number
  total: number
  created_at: string
  customer_name: string
  customer_phone: string
  items: { name: string; quantity: number; line_total: number }[]
}

export type Summary = {
  day: string
  orders: number
  cancelled: number
  revenue: number
  top_items: { name: string; quantity: number }[]
}

export type Category = { id: number; name: string; description: string; active: boolean }

export type MenuItem = {
  id: number
  category_id: number
  name: string
  description: string
  price: number
  image_url: string | null
  available: boolean
  active: boolean
  diet: Diet | null
  spicy: boolean
  bestseller: boolean
}

export type ServiceRequest = {
  id: number
  kind: 'WAITER' | 'BILL'
  created_at: string
  table_name: string
  customer_name: string
}

export type Brand = { name: string; logo_url: string | null; accent_color: string; currency: string }

export type Restaurant = Brand & {
  service_charge_percent: number
  tax_percent: number
  tax_label: string
}

export type Table = { id: number; name: string; qr_token: string; active: boolean }

/** A table plus what's happening there right now. */
export type TableStatus = Table & {
  guests: number
  open_orders: number
  open_requests: ('WAITER' | 'BILL')[]
}
