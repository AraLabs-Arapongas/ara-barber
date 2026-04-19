import type { ButtonHTMLAttributes } from 'react'
import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  cn(
    'relative inline-flex items-center justify-center gap-2 font-medium',
    'transition-[transform,background-color,color,border-color,box-shadow] duration-200 ease-out',
    'focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
    'disabled:pointer-events-none disabled:opacity-50',
    'active:scale-[0.98]',
    'whitespace-nowrap select-none',
  ),
  {
    variants: {
      variant: {
        primary: cn(
          'bg-brand-primary text-brand-primary-fg shadow-sm',
          'hover:bg-brand-primary-hover hover:shadow-md',
          'active:bg-brand-primary-active',
        ),
        secondary: cn(
          'bg-surface text-fg border border-border-strong shadow-xs',
          'hover:bg-bg-subtle hover:border-fg-muted',
        ),
        accent: cn(
          'bg-brand-accent text-brand-accent-fg shadow-sm',
          'hover:brightness-95 hover:shadow-md',
        ),
        ghost: cn('bg-transparent text-fg', 'hover:bg-bg-subtle'),
        destructive: cn('bg-error text-error-fg shadow-sm', 'hover:brightness-110 hover:shadow-md'),
        link: cn('bg-transparent text-brand-primary underline-offset-4', 'hover:underline'),
      },
      size: {
        sm: 'h-9 rounded-md px-3 text-[0.8125rem]',
        md: 'h-11 rounded-md px-5 text-[0.9375rem]',
        lg: 'h-[3.25rem] rounded-lg px-6 text-[1rem]',
        icon: 'h-10 w-10 rounded-md',
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      fullWidth: false,
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean
  loadingText?: string
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, fullWidth, loading, loadingText, disabled, children, ...props },
  ref,
) {
  const isDisabled = disabled || loading

  return (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>{loadingText ?? children}</span>
        </>
      ) : (
        children
      )}
    </button>
  )
})

export { buttonVariants }
