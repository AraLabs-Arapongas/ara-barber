'use client'

import { MASK, useMoneyHidden } from '@/lib/money-visibility'

/**
 * Renderiza um valor monetário respeitando o estado global de visibilidade.
 * Quando oculto, mostra `R$ ••••`. Sincroniza automaticamente com o toggle
 * da página via `useMoneyHidden`.
 */
export function MoneyValue({
  value,
  className,
  maskClassName,
}: {
  value: string
  className?: string
  /** Classe extra aplicada só quando mascarado (ex: pra ajustar tracking). */
  maskClassName?: string
}) {
  const { hidden } = useMoneyHidden()
  return (
    <span className={`${className ?? ''} ${hidden ? (maskClassName ?? '') : ''}`.trim()}>
      {hidden ? MASK : value}
    </span>
  )
}
