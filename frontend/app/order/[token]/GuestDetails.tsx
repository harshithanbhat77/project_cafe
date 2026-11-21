import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type Guest = { name: string; phone: string }

const STORAGE_KEY = 'cafeflow-guest'

/** Name and phone, remembered on this phone so returning guests don't type them again. */
export function loadGuest(): Guest {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return { name: String(saved.name ?? ''), phone: String(saved.phone ?? '') }
  } catch {
    return { name: '', phone: '' }
  }
}

export function saveGuest(guest: Guest) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(guest))
  } catch {
    // Private browsing: fine, they'll just type it again next time.
  }
}

/** Asked once, the first time a guest orders or calls for staff. */
export default function GuestDetails({ guest, onChange }: { guest: Guest; onChange: (guest: Guest) => void }) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-sm text-muted-foreground">So staff know who to bring it to:</legend>
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="guest-name">Your name</Label>
          <Input
            id="guest-name"
            className="h-11 text-base"
            value={guest.name}
            onChange={(e) => onChange({ ...guest, name: e.target.value })}
            placeholder="Aanya"
            autoComplete="given-name"
            required
            minLength={2}
            maxLength={100}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="guest-phone">Phone</Label>
          <Input
            id="guest-phone"
            className="h-11 text-base"
            type="tel"
            inputMode="tel"
            value={guest.phone}
            onChange={(e) => onChange({ ...guest, phone: e.target.value })}
            placeholder="98765 43210"
            autoComplete="tel"
            required
            minLength={7}
            maxLength={32}
          />
        </div>
      </div>
    </fieldset>
  )
}
