import type { HTMLAttributes } from 'react'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function Card(
  { className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'bg-surface border border-border rounded-2xl shadow-sm',
        'overflow-hidden',
        className,
      )}
      {...props}
    />
  )
})

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn('flex flex-col gap-1.5 px-6 pt-6 pb-4 sm:px-8 sm:pt-8', className)}
        {...props}
      />
    )
  },
)

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  function CardTitle({ className, ...props }, ref) {
    return (
      <h2
        ref={ref}
        className={cn(
          'font-display text-[1.75rem] leading-[1.15] tracking-tight text-fg',
          className,
        )}
        {...props}
      />
    )
  },
)

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(function CardDescription({ className, ...props }, ref) {
  return (
    <p
      ref={ref}
      className={cn('text-[0.9375rem] leading-relaxed text-fg-muted', className)}
      {...props}
    />
  )
})

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardContent({ className, ...props }, ref) {
    return <div ref={ref} className={cn('px-6 py-4 sm:px-8', className)} {...props} />
  },
)

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center justify-between gap-3 px-6 pb-6 pt-2 sm:px-8 sm:pb-8',
          className,
        )}
        {...props}
      />
    )
  },
)
