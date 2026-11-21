import { imageSrc } from '@/lib/api'
import { cn } from '@/lib/utils'

/** The restaurant's logo, or its first letter on the accent color when there's no logo. */
export function BrandMark({
  name,
  logoUrl,
  className,
}: {
  name: string
  logoUrl?: string | null
  className?: string
}) {
  if (logoUrl)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageSrc(logoUrl)}
        alt=""
        className={cn('size-10 shrink-0 rounded-xl border bg-card object-cover', className)}
      />
    )
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-semibold text-primary-foreground',
        className,
      )}
    >
      {name.trim().charAt(0).toUpperCase() || '·'}
    </span>
  )
}
