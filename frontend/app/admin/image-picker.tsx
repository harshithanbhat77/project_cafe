'use client'
import { DragEvent, useRef, useState } from 'react'
import { ImagePlus, Link2, Loader2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { imageSrc } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAdmin } from './admin-context'

const MAX_MB = 5

/** Upload a photo (click or drag and drop), or paste a link to one. */
export function ImagePicker({
  value,
  onChange,
  label = 'photo',
  square = false,
}: {
  value: string
  onChange: (url: string) => void
  label?: string
  square?: boolean
}) {
  const { upload } = useAdmin()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [linkMode, setLinkMode] = useState(false)

  async function take(file: File | undefined) {
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast.error('Choose a JPG, PNG or WebP image.')
    if (file.size > MAX_MB * 1024 * 1024) return toast.error(`That image is over ${MAX_MB} MB. Try a smaller one.`)
    setBusy(true)
    try {
      onChange(await upload(file))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  function drop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    take(e.dataTransfer.files[0])
  }

  const preview = imageSrc(value)

  return (
    <div className="space-y-2">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => take(e.target.files?.[0])}
      />
      {preview ? (
        <div className={cn('group relative overflow-hidden rounded-xl border bg-muted', square ? 'size-32' : 'aspect-[16/10]')}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="size-full object-cover" />
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Loader2 className="size-6 animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={drop}
          disabled={busy}
          className={cn(
            'flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-muted/40 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-brand-soft',
            square ? 'size-32' : 'aspect-[16/10]',
            dragging && 'border-primary bg-brand-soft',
          )}
        >
          {busy ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}
          <span className="px-2 text-center">
            {busy ? 'Uploading…' : square ? `Add ${label}` : `Drop a ${label} here or click to upload`}
          </span>
        </button>
      )}

      <div className="flex flex-wrap gap-2">
        {preview && (
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={busy}>
            <Upload /> Replace
          </Button>
        )}
        {preview && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')} disabled={busy}>
            <Trash2 /> Remove
          </Button>
        )}
        {!preview && !linkMode && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setLinkMode(true)}>
            <Link2 /> Use a link instead
          </Button>
        )}
      </div>
      {!preview && linkMode && (
        <Input
          type="url"
          placeholder="https://…"
          maxLength={500}
          autoFocus
          onBlur={(e) => {
            const url = e.target.value.trim()
            if (url.startsWith('https://')) onChange(url)
            else if (url) toast.error('Links must start with https://')
          }}
        />
      )}
    </div>
  )
}
