'use client'

import { cn } from '@/lib/utils'

type Props = {
  current: number
  total: number
  labels?: string[]
}

export function StepIndicator({ current, total, labels }: Props) {
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
        <span>
          Passo {current} de {total}
        </span>
        {labels?.[current - 1] ? <span className="text-fg-muted">{labels[current - 1]}</span> : null}
      </div>
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              i < current ? 'bg-brand-primary' : 'bg-bg-subtle',
            )}
          />
        ))}
      </div>
    </div>
  )
}
