'use client'
import { Bell, BellOff, BellRing } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAdmin } from './admin-context'

export default function NotificationControls() {
  const { notificationPermission, enableNotifications } = useAdmin()

  const description = {
    granted: 'Desktop alerts are enabled. New activity also appears in the dashboard.',
    denied: 'Browser permission is blocked. Allow notifications in your browser site settings; dashboard alerts remain available.',
    default: 'Enable desktop alerts for new orders and guest requests while this tab is in the background.',
    unsupported: 'Desktop alerts are unavailable in this browser or connection. Dashboard alerts remain available.',
  }[notificationPermission]

  return (
    <section
      aria-live="polite"
      className="mb-5 flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-primary">
        {notificationPermission === 'granted' ? (
          <BellRing className="size-5" />
        ) : notificationPermission === 'denied' || notificationPermission === 'unsupported' ? (
          <BellOff className="size-5" />
        ) : (
          <Bell className="size-5" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          Desktop notifications ·{' '}
          {notificationPermission === 'granted'
            ? 'Enabled'
            : notificationPermission === 'denied'
              ? 'Blocked'
              : notificationPermission === 'unsupported'
                ? 'Unavailable'
                : 'Not enabled'}
        </p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {notificationPermission === 'default' && (
        <Button type="button" variant="outline" onClick={enableNotifications} className="shrink-0">
          <Bell /> Enable notifications
        </Button>
      )}
    </section>
  )
}
