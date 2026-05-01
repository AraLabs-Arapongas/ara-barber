'use client'

import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { cn } from '@/lib/utils'

export type SelectSheetOption<V extends string | number> = {
  value: V
  label: string
  hint?: string
}

type Props<V extends string | number> = {
  value: V
  onChange: (value: V) => void
  options: ReadonlyArray<SelectSheetOption<V>>
  /** Texto do header da sheet. */
  sheetTitle?: string
  /** Texto pra quando value não bate com nenhuma opção. */
  placeholder?: string
  className?: string
  /** Aplica disabled style + bloqueia abertura. */
  disabled?: boolean
}

/**
 * Select que abre num bottom sheet em vez do popup nativo do browser.
 * Trigger é um botão showing label atual + chevron. Sheet tem X de
 * fechar no canto (vem do BottomSheet base) + lista de opções
 * tappable. Mobile-friendly, evita o popup horrível do iOS Safari.
 */
export function SelectSheet<V extends string | number>({
  value,
  onChange,
  options,
  sheetTitle,
  placeholder = 'Selecionar...',
  className,
  disabled = false,
}: Props<V>) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === value)

  return (
    <>
      <button
        type="button"
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        className={cn(
          'flex h-9 items-center justify-between gap-2 rounded-md border border-border bg-bg px-3 text-left text-[0.8125rem] text-fg transition-colors',
          'hover:bg-bg-subtle disabled:cursor-not-allowed disabled:opacity-40',
          className,
        )}
      >
        <span className={cn('truncate', !current && 'text-fg-subtle')}>
          {current?.label ?? placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={sheetTitle}>
        <ul className="-mx-1">
          {options.map((opt) => {
            const selected = opt.value === value
            return (
              <li key={String(opt.value)}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-md px-3 py-3 text-left text-[0.9375rem] transition-colors',
                    selected
                      ? 'bg-brand-primary/10 text-fg'
                      : 'text-fg hover:bg-bg-subtle',
                  )}
                >
                  <span className="flex-1">
                    <span className="block font-medium">{opt.label}</span>
                    {opt.hint ? (
                      <span className="mt-0.5 block text-[0.8125rem] text-fg-muted">
                        {opt.hint}
                      </span>
                    ) : null}
                  </span>
                  {selected ? (
                    <Check className="h-5 w-5 shrink-0 text-brand-primary" aria-hidden="true" />
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      </BottomSheet>
    </>
  )
}
