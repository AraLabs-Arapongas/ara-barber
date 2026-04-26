'use client'

import { Eye, EyeOff } from 'lucide-react'
import { useMoneyHidden } from '@/lib/money-visibility'

/**
 * Botão de toggle pra ocultar/mostrar valores financeiros na página inteira.
 * Sincroniza com qualquer outro componente que use `useMoneyHidden` /
 * `<MoneyValue>` via CustomEvent + localStorage.
 *
 * Posicionar tipicamente no header da página, alinhado à direita.
 */
export function MoneyVisibilityToggle({ className }: { className?: string }) {
  const { hidden, toggle } = useMoneyHidden()
  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-bg text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg ${
        className ?? ''
      }`}
      aria-label={hidden ? 'Mostrar valores financeiros' : 'Ocultar valores financeiros'}
      aria-pressed={hidden}
    >
      {hidden ? (
        <EyeOff className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Eye className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  )
}
