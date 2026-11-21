// Unset (e.g. `npm run dev`) → local API. Empty string (production) → same origin, routed by Caddy.
export const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8001'

/** Turn a FastAPI error response into one readable sentence. */
export async function errorMessage(res: Response, fallback: string): Promise<string> {
  if (res.status === 429) return 'Too many attempts. Please wait a minute and try again.'
  const body = await res.json().catch(() => null)
  const detail = body?.detail
  if (typeof detail === 'string') return detail
  // Validation errors come back as a list: [{msg: "Value error, Enter your name", ...}]
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg).replace(/^Value error, /, '')
  return fallback
}

const formatters = new Map<string, Intl.NumberFormat[]>()

/** ₹240 or ₹320.50: whole amounts without decimals, others with two. */
export function money(amount: number, currency = 'INR'): string {
  let pair = formatters.get(currency)
  if (!pair) {
    // Indian digit grouping (₹1,00,000) for rupees; standard grouping otherwise.
    const locale = currency === 'INR' ? 'en-IN' : 'en-US'
    const base = { style: 'currency', currency } as const
    pair = [
      new Intl.NumberFormat(locale, { ...base, minimumFractionDigits: 0, maximumFractionDigits: 0 }),
      new Intl.NumberFormat(locale, { ...base, minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    ]
    formatters.set(currency, pair)
  }
  const whole = Math.round(amount * 100) % 100 === 0
  return pair[whole ? 0 : 1].format(amount)
}

/** Uploaded images are stored as "/api/uploads/…" on the API; links to other sites are used as-is. */
export function imageSrc(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  return url.startsWith('/') ? `${API}${url}` : url
}
