'use client'
import { FormEvent, useState } from 'react'
import { Check, Loader2, ShieldOff } from 'lucide-react'
import { toast } from 'sonner'
import { BrandMark } from '@/components/brand-mark'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { money } from '@/lib/api'
import { brandStyle, readableOn } from '@/lib/brand'
import { cn } from '@/lib/utils'
import { useAdmin } from '../admin-context'
import { ImagePicker } from '../image-picker'
import type { Restaurant } from '../types'
import { EmptyState, PageHeader } from '../ui'

// Every swatch is dark enough for white text on buttons.
const SWATCHES = ['#b4532a', '#b91c1c', '#be185d', '#7e22ce', '#4338ca', '#1d4ed8', '#0f766e', '#15803d', '#a16207', '#44403c', '#171717']

const CURRENCIES = [
  ['INR', 'Indian rupee'],
  ['USD', 'US dollar'],
  ['EUR', 'Euro'],
  ['GBP', 'British pound'],
  ['AED', 'UAE dirham'],
  ['SGD', 'Singapore dollar'],
  ['AUD', 'Australian dollar'],
  ['CAD', 'Canadian dollar'],
  ['LKR', 'Sri Lankan rupee'],
  ['NPR', 'Nepalese rupee'],
  ['BDT', 'Bangladeshi taka'],
  ['MYR', 'Malaysian ringgit'],
  ['THB', 'Thai baht'],
  ['ZAR', 'South African rand'],
]

type Form = Omit<Restaurant, 'service_charge_percent' | 'tax_percent' | 'logo_url'> & {
  logo_url: string
  service_charge_percent: string
  tax_percent: string
}

export default function SettingsPage() {
  const { restaurant, isOwner } = useAdmin()
  if (!isOwner) return <EmptyState icon={ShieldOff} title="Only the owner can change settings" className="mt-10" />
  if (!restaurant) return <div className="h-96 animate-pulse rounded-2xl bg-muted" />
  return <SettingsForm restaurant={restaurant} />
}

function SettingsForm({ restaurant }: { restaurant: Restaurant }) {
  const { call, reloadRestaurant } = useAdmin()
  const initial: Form = {
    ...restaurant,
    logo_url: restaurant.logo_url ?? '',
    service_charge_percent: String(restaurant.service_charge_percent),
    tax_percent: String(restaurant.tax_percent),
  }
  const [form, setForm] = useState<Form>(initial)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }))

  // Only send what changed.
  const changes = Object.fromEntries(
    (Object.keys(form) as (keyof Form)[])
      .filter((k) => form[k] !== initial[k])
      .map((k) => [k, k === 'logo_url' ? form.logo_url || null : form[k]]),
  )
  const dirty = Object.keys(changes).length > 0

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await call('/api/admin/settings', { method: 'PATCH', body: changes })
      await reloadRestaurant()
      toast.success('Settings saved', { description: 'Guests see the changes the next time they open the menu.' })
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const accentValid = /^#[0-9a-fA-F]{6}$/.test(form.accent_color)
  const service = Number(form.service_charge_percent) || 0
  const tax = Number(form.tax_percent) || 0
  const sample = 1000
  const sampleService = Math.round(sample * service) / 100
  const sampleTax = Math.round((sample + sampleService) * tax) / 100

  return (
    <form onSubmit={submit} className="pb-24">
      <PageHeader title="Settings" description="Your restaurant's name, look and bill. Changes apply to the guest menu, QR cards and this dashboard." />

      <div className="space-y-6">
        <Section title="Branding" description="Shown on the guest menu, the sign-in page and printed QR cards.">
          <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="restaurant-name">Restaurant name</Label>
                <Input id="restaurant-name" value={form.name} onChange={(e) => set('name', e.target.value)} required maxLength={80} />
              </div>

              <div className="space-y-2">
                <Label>Logo</Label>
                <ImagePicker value={form.logo_url} onChange={(url) => set('logo_url', url)} label="logo" square />
                <p className="text-xs text-muted-foreground">A square image works best. Without one, the first letter of your name is used.</p>
              </div>

              <div className="space-y-3">
                <Label>Brand color</Label>
                <div className="flex flex-wrap gap-2">
                  {SWATCHES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => set('accent_color', color)}
                      className={cn(
                        'flex size-9 items-center justify-center rounded-full ring-offset-2 ring-offset-card transition-transform hover:scale-110',
                        form.accent_color.toLowerCase() === color && 'ring-2 ring-foreground',
                      )}
                      style={{ backgroundColor: color }}
                      aria-label={`Use color ${color}`}
                      aria-pressed={form.accent_color.toLowerCase() === color}
                    >
                      {form.accent_color.toLowerCase() === color && <Check className="size-4 text-white" />}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={accentValid ? form.accent_color : '#000000'}
                    onChange={(e) => set('accent_color', e.target.value)}
                    className="size-10 cursor-pointer rounded-lg border bg-card p-1"
                    aria-label="Pick a custom color"
                  />
                  <Input
                    value={form.accent_color}
                    onChange={(e) => set('accent_color', e.target.value)}
                    className="w-32 font-mono"
                    pattern="#[0-9a-fA-F]{6}"
                    title="A color like #b4532a"
                    aria-label="Brand color code"
                  />
                  {accentValid && readableOn(form.accent_color) !== '#ffffff' && (
                    <p className="text-xs text-muted-foreground">Light color: buttons will use dark text.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Live preview of the guest menu header and button. */}
            <div>
              <p className="mb-2 text-sm font-medium">Preview</p>
              {/* A miniature of the real guest menu, so the owner sees their name, logo and color in place. */}
              <div style={brandStyle(form.accent_color)} className="overflow-hidden rounded-2xl border bg-background shadow-sm">
                <div className="px-4 pt-5 pb-4 text-center">
                  {form.logo_url && <BrandMark name={form.name} logoUrl={form.logo_url} className="mx-auto mb-2 size-9 rounded-full" />}
                  <p className="text-[10px] tracking-[0.25em] text-muted-foreground uppercase">Table 4</p>
                  <p className="font-heading text-2xl leading-tight italic">{form.name || 'Your restaurant'}</p>
                </div>
                <div className="flex gap-4 border-y px-4 text-xs">
                  <span className="border-b-2 border-primary py-2 font-semibold text-primary">Coffee</span>
                  <span className="py-2 text-muted-foreground">Breakfast</span>
                  <span className="py-2 text-muted-foreground">Desserts</span>
                </div>
                <div className="flex items-center gap-3 px-4 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline gap-1.5 text-sm">
                      <span className="font-heading font-semibold">Masala chai</span>
                      <span className="flex-1 -translate-y-0.5 border-b border-dotted border-muted-foreground/50" />
                      <span className="font-semibold">{money(120, form.currency)}</span>
                    </p>
                    <p className="mt-1 text-[10px] font-medium tracking-wider text-primary uppercase">House favourite</p>
                  </div>
                  <span className="rounded-full border border-primary px-3 py-1 text-xs font-semibold text-primary">+ Add</span>
                </div>
                <div className="flex items-center justify-between bg-ink px-4 py-3 text-xs text-paper">
                  <span>1 item · {money(120, form.currency)}</span>
                  <span className="font-heading text-sm italic">View order →</span>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Bill" description="Service charge and tax are added to every new order. Past bills keep the rates they were made with.">
          <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={(v) => set('currency', v)}>
                  <SelectTrigger className="w-full sm:w-72" aria-label="Currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(([code, label]) => (
                      <SelectItem key={code} value={code}>
                        {code} · {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <PercentField
                id="service"
                label="Service charge"
                value={form.service_charge_percent}
                onChange={(v) => set('service_charge_percent', v)}
              />
              <div />
              <div className="space-y-2">
                <Label htmlFor="tax-label">Tax name</Label>
                <Input id="tax-label" value={form.tax_label} onChange={(e) => set('tax_label', e.target.value)} required maxLength={20} placeholder="GST, VAT…" />
              </div>
              <PercentField id="tax" label="Tax rate" value={form.tax_percent} onChange={(v) => set('tax_percent', v)} />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Example bill</p>
              <dl className="space-y-1.5 rounded-2xl border bg-background p-4 text-sm">
                <Line label="Food" value={money(sample, form.currency)} />
                <Line label={`Service charge (${service}%)`} value={money(sampleService, form.currency)} />
                <Line label={`${form.tax_label || 'Tax'} (${tax}%)`} value={money(sampleTax, form.currency)} />
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{money(sample + sampleService + sampleTax, form.currency)}</dd>
                </div>
                <p className="pt-1 text-xs text-muted-foreground">Tax is charged on food plus service.</p>
              </dl>
            </div>
          </div>
        </Section>
      </div>

      {/* Save bar appears once something has changed. */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 backdrop-blur transition-transform md:left-60',
          dirty ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <p className="mr-auto text-sm text-muted-foreground">You have unsaved changes.</p>
          <Button type="button" variant="outline" size="lg" onClick={() => setForm(initial)} disabled={busy}>
            Discard
          </Button>
          <Button size="lg" disabled={busy || !dirty}>
            {busy && <Loader2 className="animate-spin" />} Save changes
          </Button>
        </div>
      </div>
    </form>
  )
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card">
      <header className="border-b px-5 py-4">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

function PercentField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          pattern="\d{1,3}(\.\d{1,2})?"
          title="A percentage like 5 or 12.5"
          required
          className="pr-8"
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">%</span>
      </div>
    </div>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}
