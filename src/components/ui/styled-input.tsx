'use client'

import { forwardRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input, type InputProps } from '@/components/ui/input'

type StyledInputProps = Omit<InputProps, 'rightSlot'> & {
  /**
   * Quando definido, mostra um botão X interno à direita do input.
   * Tappar dispara onClear. Se onClear não for passado, X não aparece.
   */
  onClear?: () => void
  clearLabel?: string
  clearDisabled?: boolean
}

/**
 * Wrapper do Input que injeta um botão X dentro do input (via rightSlot)
 * pra ações tipo "limpar valor", "remover row de lista" etc. Mantém a
 * mesma API do Input pra todo o resto.
 */
export const StyledInput = forwardRef<HTMLInputElement, StyledInputProps>(
  function StyledInput(
    { onClear, clearLabel = 'Limpar', clearDisabled = false, ...rest },
    ref,
  ) {
    const slot = onClear ? (
      <button
        type="button"
        onClick={onClear}
        disabled={clearDisabled}
        aria-label={clearLabel}
        tabIndex={-1}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-md',
          'text-fg-subtle transition-colors',
          'hover:bg-bg hover:text-fg',
          'disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent',
        )}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    ) : undefined
    return <Input ref={ref} rightSlot={slot} {...rest} />
  },
)
