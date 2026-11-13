import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

/** − 2 + control. Calls onChange with +1 or −1. */
export default function QuantityStepper({
  quantity,
  name,
  onChange,
  size = 'md',
  className,
}: {
  quantity: number
  name: string
  onChange: (delta: number) => void
  size?: 'md' | 'lg'
  className?: string
}) {
  const button = cn(
    'flex items-center justify-center text-primary transition-colors hover:bg-primary/10 active:bg-primary/20',
    size === 'lg' ? 'size-12' : 'size-9',
  )
  return (
    <div
      className={cn(
        'inline-flex items-center overflow-hidden rounded-full border border-primary bg-card font-semibold',
        className,
      )}
    >
      <button type="button" className={button} onClick={() => onChange(-1)} aria-label={`Remove one ${name}`}>
        <Minus className="size-4" />
      </button>
      <span className={cn('min-w-5 text-center tabular-nums', size === 'lg' && 'min-w-10 text-lg')} aria-live="polite">
        {quantity}
      </span>
      <button type="button" className={button} onClick={() => onChange(1)} aria-label={`Add one ${name}`}>
        <Plus className="size-4" />
      </button>
    </div>
  )
}
