'use client'

import { TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { MASK, useMoneyHidden } from '@/lib/money-visibility'

/**
 * Stat card de valor monetário. Visibilidade controlada pelo toggle global
 * da página (`<MoneyVisibilityToggle>` no header). Quando oculto, valor e hint
 * viram `R$ ••••` / `••••`.
 */
export function MoneyStatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  const { hidden } = useMoneyHidden()

  return (
    <Card>
      <CardContent className="py-3">
        <p className="flex items-center gap-1.5 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
          <TrendingUp className="h-4 w-4" aria-hidden="true" />
          {label}
        </p>
        <p className="mt-1 font-display text-[1.375rem] font-semibold leading-tight tracking-tight text-fg tabular-nums">
          {hidden ? MASK : value}
        </p>
        <p className="mt-0.5 text-[0.8125rem] text-fg-muted">{hidden ? '••••' : hint}</p>
      </CardContent>
    </Card>
  )
}
