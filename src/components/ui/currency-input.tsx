'use client'

import { forwardRef, useEffect, useRef } from 'react'
import { Input, type InputProps } from '@/components/ui/input'

type CurrencyInputProps = Omit<InputProps, 'value' | 'onChange' | 'type' | 'inputMode'> & {
  /** Valor em centavos (R$ 12,34 = 1234). */
  valueCents: number
  /** Callback recebe o novo valor em centavos. */
  onChangeCents: (cents: number) => void
  /** Limite máximo em centavos. Default: sem limite (Number.MAX_SAFE_INTEGER). */
  maxCents?: number
}

function formatCents(cents: number): string {
  // Exibe 0 como "0,00", 1234 como "12,34", 1234567 como "12.345,67".
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Input com máscara de moeda BR (R$). Comportamento "incremental cents":
 * usuário digita dígitos, vão preenchendo da direita pra esquerda.
 *
 *   "" + 5 → "0,05"
 *   "0,05" + 0 → "0,50"
 *   "0,50" + 0 → "5,00"
 *   "5,00" + 0 → "50,00"
 *   backspace de "50,00" → "5,00"
 *
 * Aceita só dígitos como input — vírgula/ponto/letras são ignorados.
 * Sempre alinhado à direita, cursor força no fim pra evitar
 * posicionamento estranho durante a digitação.
 */
export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  function CurrencyInput(
    { valueCents, onChangeCents, maxCents = Number.MAX_SAFE_INTEGER, className, ...rest },
    forwardedRef,
  ) {
    const innerRef = useRef<HTMLInputElement | null>(null)

    function setRefs(node: HTMLInputElement | null) {
      innerRef.current = node
      if (typeof forwardedRef === 'function') forwardedRef(node)
      else if (forwardedRef) forwardedRef.current = node
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const digits = e.target.value.replace(/\D/g, '')
      const cents = digits === '' ? 0 : Math.min(parseInt(digits, 10), maxCents)
      onChangeCents(cents)
    }

    // Após cada render, força cursor pro fim quando o input está focado.
    // Sem isso, mudar o display ("0,05" → "0,50") quebra a posição visual.
    useEffect(() => {
      const el = innerRef.current
      if (!el || document.activeElement !== el) return
      const len = el.value.length
      el.setSelectionRange(len, len)
    })

    return (
      <Input
        ref={setRefs}
        type="text"
        inputMode="numeric"
        value={formatCents(valueCents)}
        onChange={handleChange}
        className={className ? `text-right ${className}` : 'text-right'}
        {...rest}
      />
    )
  },
)
