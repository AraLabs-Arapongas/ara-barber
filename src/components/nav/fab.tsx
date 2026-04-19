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
 * - Com `actions`: abre speed dial com backdrop. Cada opção é uma pill
 *   única (icon + label) com alto contraste.
 */
export function Fab({ onClick, actions, icon, srLabel = 'Ação', children }: Props) {
  const Icon = icon ?? Plus
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onEsc)
    return () => {
      window.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const hasMenu = (actions?.length ?? 0) > 0
  const handlePrimary = () => {
    if (hasMenu) setOpen((v) => !v)
    else onClick?.()
  }

  return (
    <>
      {hasMenu && open ? (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-fg/25 backdrop-blur-[2px] animate-in fade-in duration-150"
        />
      ) : null}

      <div
        ref={wrapperRef}
        className="fixed z-50 right-4 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] sm:right-6 flex flex-col items-end"
      >
        {hasMenu && open ? (
          <ul className="mb-3 flex flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
            {actions!.map((a) => {
              const ItemIcon = a.icon
              return (
                <li key={a.label}>
                  <button
                    type="button"
                    onClick={() => {
                      a.onClick()
                      setOpen(false)
                    }}
                    className={cn(
                      'flex items-center gap-2 rounded-full px-4 py-2.5',
                      'bg-fg text-bg shadow-lg',
                      'transition-transform hover:scale-[1.03] active:scale-95',
                    )}
                  >
                    <ItemIcon className="h-4 w-4" aria-hidden="true" />
                    <span className="text-[0.8125rem] font-medium">{a.label}</span>
                  </button>
                </li>
              )
            })}
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
          {children ?? (
            <Icon
              className={cn('h-6 w-6 transition-transform', hasMenu && open && 'rotate-45')}
              aria-hidden="true"
            />
          )}
        </button>
      </div>
    </>
  )
}
