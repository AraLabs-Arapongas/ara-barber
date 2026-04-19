'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Plus, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type FabAction = {
  label: string
  icon: LucideIcon
  onClick: () => void
}

type Props = {
  onClick?: () => void
  actions?: FabAction[]
  icon?: LucideIcon
  label?: string
  srLabel?: string
  children?: ReactNode
}

/**
 * Floating action button fixo no canto inferior direito, acima da tab bar.
 * - Com `onClick`: botão de ação única.
 * - Com `actions`: abre menu radial acima do FAB com as opções.
 */
export function Fab({ onClick, actions, icon, srLabel = 'Ação', children }: Props) {
  const Icon = icon ?? Plus
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDocClick)
    window.addEventListener('keydown', onEsc)
    return () => {
      window.removeEventListener('mousedown', onDocClick)
      window.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const hasMenu = (actions?.length ?? 0) > 0
  const handlePrimary = () => {
    if (hasMenu) setOpen((v) => !v)
    else onClick?.()
  }

  return (
    <div
      ref={wrapperRef}
      className="fixed z-50 right-4 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] sm:right-6"
    >
      {hasMenu && open ? (
        <ul className="mb-3 flex flex-col gap-2">
          {actions!.map((a) => (
            <li key={a.label} className="flex items-center justify-end gap-2">
              <span className="rounded-md bg-fg/85 px-2.5 py-1 text-[0.75rem] font-medium text-bg shadow-sm">
                {a.label}
              </span>
              <button
                type="button"
                onClick={() => {
                  a.onClick()
                  setOpen(false)
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-raised text-fg shadow-md transition-transform hover:scale-105 active:scale-95"
                aria-label={a.label}
              >
                <a.icon className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        onClick={handlePrimary}
        aria-label={srLabel}
        aria-expanded={hasMenu ? open : undefined}
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-full',
          'bg-brand-primary text-brand-primary-fg shadow-lg',
          'transition-[transform,background-color,box-shadow]',
          'hover:shadow-xl hover:bg-brand-primary-hover',
          'active:scale-95',
        )}
      >
        {children ?? <Icon className={cn('h-6 w-6 transition-transform', hasMenu && open && 'rotate-45')} aria-hidden="true" />}
      </button>
    </div>
  )
}
