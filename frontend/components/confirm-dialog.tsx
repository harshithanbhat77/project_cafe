'use client'
import { ReactNode, useCallback, useRef, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type Options = {
  title: string
  description: ReactNode
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
}

/**
 * A styled replacement for window.confirm:
 *   const [confirm, confirmDialog] = useConfirm()
 *   if (await confirm({ title, description, confirmLabel })) ...
 * Render {confirmDialog} somewhere in the component.
 */
export function useConfirm(): [(options: Options) => Promise<boolean>, ReactNode] {
  const [options, setOptions] = useState<Options | null>(null)
  const resolver = useRef<(answer: boolean) => void>(undefined)

  const confirm = useCallback((next: Options) => {
    setOptions(next)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  function answer(value: boolean) {
    resolver.current?.(value)
    resolver.current = undefined
    setOptions(null)
  }

  const dialog = (
    <AlertDialog open={options !== null} onOpenChange={(open) => !open && answer(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{options?.title}</AlertDialogTitle>
          <AlertDialogDescription>{options?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => answer(false)}>{options?.cancelLabel ?? 'Cancel'}</AlertDialogCancel>
          <AlertDialogAction
            variant={options?.destructive ? 'destructive' : 'default'}
            onClick={() => answer(true)}
          >
            {options?.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return [confirm, dialog]
}
