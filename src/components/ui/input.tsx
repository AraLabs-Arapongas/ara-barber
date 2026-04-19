import type { InputHTMLAttributes, ReactNode } from 'react'
import { forwardRef, useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  /** Slot renderizado à direita do label (ex: link "Esqueci?"). */
  labelAction?: ReactNode
  hint?: string
  error?: string
  leftIcon?: ReactNode
  rightSlot?: ReactNode
  containerClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    id,
    label,
    labelAction,
    hint,
    error,
    leftIcon,
    rightSlot,
    className,
    containerClassName,
    type = 'text',
    required,
    ...props
  },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`

  const [reveal, setReveal] = useState(false)
  const isPassword = type === 'password'
  const effectiveType = isPassword && reveal ? 'text' : type

  return (
    <div className={cn('flex w-full flex-col gap-1.5', containerClassName)}>
      {label || labelAction ? (
        <div className="flex items-center justify-between gap-2">
          {label ? (
            <label
              htmlFor={inputId}
              className="flex items-center gap-1 text-[0.8125rem] font-medium text-fg"
            >
              {label}
              {required ? (
                <span className="text-fg-subtle" aria-hidden="true">
                  *
                </span>
              ) : null}
            </label>
          ) : (
            <span />
          )}
          {labelAction}
        </div>
      ) : null}

      <div
        className={cn(
          'group relative flex items-stretch',
          'rounded-lg border',
          'transition-[border-color,box-shadow,background-color] duration-200 ease-out',
          error
            ? cn(
                'border-error bg-error-bg/60',
                'shadow-[0_0_0_3px_color-mix(in_oklch,var(--color-error)_12%,transparent)]',
              )
            : cn(
                'border-transparent bg-bg-subtle',
                'hover:bg-bg-subtle/80',
                'focus-within:border-brand-primary focus-within:bg-surface-raised',
                'focus-within:shadow-[0_0_0_3px_color-mix(in_oklch,var(--brand-accent)_22%,transparent)]',
              ),
        )}
      >
        {leftIcon ? (
          <div
            className="flex shrink-0 items-center pl-3.5 text-fg-subtle transition-colors group-focus-within:text-fg-muted"
            aria-hidden="true"
          >
            {leftIcon}
          </div>
        ) : null}

        <input
          ref={ref}
          id={inputId}
          type={effectiveType}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={cn(hint ? hintId : '', error ? errorId : '').trim() || undefined}
          className={cn(
            'min-w-0 flex-1 bg-transparent px-3.5 py-3 text-[0.9375rem] text-fg',
            'placeholder:text-fg-subtle',
            'focus:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-60',
            leftIcon ? 'pl-2.5' : '',
            isPassword || rightSlot ? 'pr-2' : '',
            className,
          )}
          {...props}
        />

        {isPassword ? (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            tabIndex={-1}
            aria-label={reveal ? 'Ocultar senha' : 'Mostrar senha'}
            className={cn(
              'flex shrink-0 items-center justify-center px-3.5',
              'text-fg-subtle transition-colors hover:text-fg',
            )}
          >
            {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        ) : rightSlot ? (
          <div className="flex shrink-0 items-center pr-3.5">{rightSlot}</div>
        ) : null}
      </div>

      {error ? (
        <p id={errorId} role="alert" className="text-[0.8125rem] text-error">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[0.8125rem] text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
})
