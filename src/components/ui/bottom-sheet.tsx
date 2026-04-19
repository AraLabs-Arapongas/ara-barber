'use client'

import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
}

/**
 * Bottom sheet modal mobile-first. Slides up from bottom with backdrop overlay.
 * Em desktop vira centralizado (max-w-md) pra não ficar feio.
 */
export function BottomSheet({ open, onClose, title, description, children }: Props) {
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onEsc)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onEsc)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
    >
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-fg/50 backdrop-blur-sm"
      />

      <div
        className={cn(
          'relative w-full max-h-[92vh] overflow-hidden',
          'rounded-t-2xl bg-surface shadow-2xl',
          'sm:max-w-md sm:rounded-2xl sm:mx-4',
          'animate-in slide-in-from-bottom duration-200',
        )}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
          <div className="min-w-0 flex-1">
            {title ? (
              <h2 className="font-display text-[1.375rem] font-semibold leading-tight tracking-tight text-fg">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-[0.875rem] text-fg-muted">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-bg-subtle hover:text-fg"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[calc(92vh-4rem)] overflow-y-auto px-5 pb-6 pt-5 sm:px-6 sm:pb-7">
          {children}
        </div>
      </div>
    </div>
  )
}
