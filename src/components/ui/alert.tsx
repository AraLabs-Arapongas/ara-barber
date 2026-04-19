import type { HTMLAttributes, ReactNode } from 'react'
import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

const alertVariants = cva(
  cn(
    'relative flex w-full items-start gap-3',
    'rounded-lg border px-4 py-3',
    'text-[0.875rem] leading-snug',
  ),
  {
    variants: {
      variant: {
        success: 'bg-success-bg text-fg border-success-border',
        warning: 'bg-warning-bg text-fg border-warning-border',
        error: 'bg-error-bg text-fg border-error-border',
        info: 'bg-info-bg text-fg border-info-border',
      },
    },
    defaultVariants: { variant: 'info' },
  },
)

const iconMap = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
} as const

const iconColorMap = {
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
  info: 'text-info',
} as const

export interface AlertProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'title'>, VariantProps<typeof alertVariants> {
  title?: ReactNode
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert(
  { className, variant = 'info', title, children, ...props },
  ref,
) {
  const variantKey = variant ?? 'info'
  const Icon = iconMap[variantKey]

  return (
    <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      <Icon
        className={cn('mt-0.5 h-5 w-5 shrink-0', iconColorMap[variantKey])}
        aria-hidden="true"
      />
      <div className="flex-1 space-y-0.5">
        {title ? <p className="font-semibold text-fg">{title}</p> : null}
        <div className="text-fg-muted">{children}</div>
      </div>
    </div>
  )
})
