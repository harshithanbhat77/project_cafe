import type { Diet } from '@/components/diet-marker'

export type Item = {
  id: number
  name: string
  description: string
  price: number
  image_url: string | null
  available: boolean
  diet: Diet | null
  spicy: boolean
  bestseller: boolean
}
export type ServiceRequest = { id: number; kind: 'WAITER' | 'BILL'; created_at: string }
export type Category = { id: number; name: string; description: string; items: Item[] }
export type Charges = { service_charge_percent: number; tax_percent: number; tax_label: string }
export type Brand = { name: string; logo_url: string | null; accent_color: string; currency: string }
export type Menu = { restaurant: Brand; table: { name: string }; categories: Category[]; charges: Charges }
export type OrderStatus = 'PLACED' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED'
export type OrderLine = { name: string; quantity: number; line_total: number }
export type Order = {
  id: number
  reference: string
  status: OrderStatus
  notes: string | null
  subtotal: number
  service_charge: number
  tax: number
  total: number
  created_at: string
  items: OrderLine[]
}
/** Item id -> quantity. */
export type Cart = Record<number, number>
