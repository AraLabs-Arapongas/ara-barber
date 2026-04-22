'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Sheet } from 'react-modal-sheet'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
}

/**
 * Bottom sheet usando react-modal-sheet. Drag-to-dismiss, snap point
 * automático no conteúdo, animação suave. API simplificada com título,
 * descrição e children.
 */
export function BottomSheet({ open, onClose, title, description, children }: Props) {
  return (
    <Sheet isOpen={open} onClose={onClose} detent="content">
      <Sheet.Container
        style={{
          backgroundColor: 'var(--color-surface)',
          boxShadow: '0 -8px 32px rgb(0 0 0 / 0.18)',
          // iOS Safari: vh inclui a área da URL bar inferior; svh respeita a
          // visible viewport considerando toolbars sempre visíveis. Sem isso,
          // a parte inferior da sheet fica escondida atrás da barra.
          maxHeight: '100svh',
        }}
      >
        <Sheet.Header>
          <div className="flex items-center justify-center pt-2.5 pb-1">
            <span className="h-1 w-10 rounded-full bg-fg/20" aria-hidden="true" />
          </div>
          <div className="flex items-start justify-between gap-3 px-5 pt-1 pb-3 sm:px-6">
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
              className={cn(
                'rounded-md p-1.5 text-fg-subtle transition-colors',
                'hover:bg-bg-subtle hover:text-fg',
              )}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </Sheet.Header>
        <Sheet.Content disableDrag>
          <div className="max-h-[70svh] overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-1 sm:px-6">
            {children}
          </div>
        </Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop
        onTap={onClose}
        style={{ backgroundColor: 'color-mix(in oklch, var(--color-fg) 45%, transparent)' }}
      />
    </Sheet>
  )
}
