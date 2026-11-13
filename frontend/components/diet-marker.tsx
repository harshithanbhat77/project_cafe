import { cn } from '@/lib/utils'

export type Diet = 'VEG' | 'EGG' | 'NON_VEG' | 'VEGAN'

export const DIET_LABEL: Record<Diet, string> = {
  VEG: 'Vegetarian',
  EGG: 'Contains egg',
  NON_VEG: 'Non-vegetarian',
  VEGAN: 'Vegan',
}

export const DIET_SHORT: Record<Diet, string> = { VEG: 'Veg', EGG: 'Egg', NON_VEG: 'Non-veg', VEGAN: 'Vegan' }

// The familiar Indian food marking: a square outline with a dot (veg) or triangle (non-veg).
const COLOR: Record<Diet, string> = {
  VEG: 'border-green-600 text-green-600',
  VEGAN: 'border-green-600 text-green-600',
  EGG: 'border-amber-500 text-amber-500',
  NON_VEG: 'border-red-700 text-red-700',
}

export function DietMarker({ diet, className }: { diet: Diet | null; className?: string }) {
  if (!diet) return null
  return (
    <span
      role="img"
      aria-label={DIET_LABEL[diet]}
      title={DIET_LABEL[diet]}
      className={cn('inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] border-[1.5px]', COLOR[diet], className)}
    >
      {diet === 'NON_VEG' ? (
        <svg viewBox="0 0 10 10" className="size-2 fill-current" aria-hidden>
          <path d="M5 1 9.5 9h-9z" />
        </svg>
      ) : (
        <span className="size-2 rounded-full bg-current" />
      )}
    </span>
  )
}

/** Veg-only filter: vegetarian and vegan dishes (egg dishes are left out, as is customary). */
export const isVegetarian = (diet: Diet | null) => diet === 'VEG' || diet === 'VEGAN'
