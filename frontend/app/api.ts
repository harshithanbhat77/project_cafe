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
