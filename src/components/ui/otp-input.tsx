'use client'

import { useRef, useState, type ChangeEvent, type MouseEvent, type SyntheticEvent } from 'react'
import { cn } from '@/lib/utils'

export interface OtpInputProps {
  value: string
  onChange: (value: string) => void
  length?: number
  autoFocus?: boolean
  disabled?: boolean
  error?: boolean
  ariaLabel?: string
  name?: string
}

export function OtpInput({
  value,
  onChange,
  length = 6,
  autoFocus = false,
  disabled = false,
  error = false,
  ariaLabel = 'Código de verificação',
  name,
}: OtpInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  const [caret, setCaret] = useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  })

  const digits = Array.from({ length }, (_, i) => value[i] ?? '')
  const isError = Boolean(error)

  function syncCaret(el: HTMLInputElement) {
    setCaret({
      start: el.selectionStart ?? 0,
      end: el.selectionEnd ?? 0,
    })
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const next = e.target.value.replace(/\D/g, '').slice(0, length)
    onChange(next)
    requestAnimationFrame(() => {
      const input = inputRef.current
      if (!input) return
      const pos = input.selectionStart ?? 0
      // Se o próximo box já tem dígito, seleciona-o pra que o próximo
      // keystroke substitua em vez de tentar inserir (bloqueado por maxLength).
      if (pos < length && next[pos]) {
        input.setSelectionRange(pos, pos + 1)
      }
      syncCaret(input)
    })
  }

  function handleSelect(e: SyntheticEvent<HTMLInputElement>) {
    syncCaret(e.currentTarget)
  }

  function handleBoxMouseDown(e: MouseEvent, i: number) {
    if (disabled) return
    e.preventDefault()
    const input = inputRef.current
    if (!input) return
    input.focus()
    if (value[i]) {
      // Seleciona o dígito existente pra substituição.
      input.setSelectionRange(i, i + 1)
    } else {
      // Posiciona o caret no fim do que já foi digitado.
      const pos = Math.min(i, value.length)
      input.setSelectionRange(pos, pos)
    }
    syncCaret(input)
  }

  const activeIndex = (() => {
    if (!focused) return -1
    if (caret.end > caret.start) return caret.start
    return Math.min(caret.start, length - 1)
  })()

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="relative flex items-center justify-between gap-2"
    >
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d*"
        maxLength={length}
        disabled={disabled}
        autoFocus={autoFocus}
        value={value}
        onChange={handleChange}
        onFocus={(e) => {
          setFocused(true)
          syncCaret(e.currentTarget)
        }}
        onBlur={() => setFocused(false)}
        onSelect={handleSelect}
        onKeyUp={handleSelect}
        name={name}
        aria-label={ariaLabel}
        className="absolute inset-0 -z-10 h-full w-full cursor-text bg-transparent text-transparent caret-transparent opacity-0 outline-none"
      />
      {digits.map((digit, i) => (
        <div
          key={i}
          role="presentation"
          onMouseDown={(e) => handleBoxMouseDown(e, i)}
          className={cn(
            'relative flex aspect-square w-full min-w-0 max-w-14 flex-1 cursor-text items-center justify-center',
            'rounded-lg border bg-surface-raised',
            'transition-[border-color] duration-200 ease-out',
            isError ? 'border-error' : activeIndex === i ? 'border-brand-primary' : 'border-border',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          {digit ? (
            <span className="pointer-events-none text-xl font-semibold text-fg tabular-nums">
              {digit}
            </span>
          ) : activeIndex === i ? (
            <span
              aria-hidden="true"
              className="pointer-events-none inline-block h-6 w-px animate-caret-blink bg-fg"
            />
          ) : (
            <span className="pointer-events-none text-xl font-semibold text-fg tabular-nums">
              {'\u00A0'}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
