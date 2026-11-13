import { useEffect, type CSSProperties } from 'react'

export const DEFAULT_ACCENT = '#b4532a'

/** WCAG relative luminance of a #rrggbb color (0 = black, 1 = white). */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Black or white text, whichever reads better on the accent color. */
export function readableOn(hex: string): string {
  // Contrast against white vs. against near-black (#171717).
  const l = luminance(hex)
  const onWhite = 1.05 / (l + 0.05)
  const onBlack = (l + 0.05) / (luminance('#171717') + 0.05)
  return onWhite >= onBlack ? '#ffffff' : '#171717'
}

/** CSS variables that recolor buttons, rings and highlights with the restaurant's accent. */
export function brandStyle(accent: string | null | undefined): CSSProperties {
  const color = accent && /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : DEFAULT_ACCENT
  return {
    '--primary': color,
    '--primary-foreground': readableOn(color),
    '--ring': color,
    '--brand-soft': `color-mix(in oklch, ${color} 12%, white)`,
  } as CSSProperties
}

/** Apply the accent to the whole page, including dialogs and drawers (which render outside the app's root element). */
export function useBrandAccent(accent: string | null | undefined) {
  useEffect(() => {
    if (accent === undefined) return
    const root = document.documentElement
    const vars = brandStyle(accent) as Record<string, string>
    Object.entries(vars).forEach(([name, value]) => root.style.setProperty(name, value))
    return () => Object.keys(vars).forEach((name) => root.style.removeProperty(name))
  }, [accent])
}
