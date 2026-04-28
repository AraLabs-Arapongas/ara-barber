'use client'

import { Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { BookingService } from '@/lib/booking/queries'
import { formatCentsToBrl } from '@/lib/money'

export function ServiceStep({
  services,
  value,
  onChange,
  onBack,
  onNext,
  showBack = true,
}: {
  services: BookingService[]
  value: string | null
  onChange: (id: string) => void
  onBack: () => void
  onNext: () => void
  /** Cliente pode esconder "Voltar" no primeiro step. */
  showBack?: boolean
}) {
  return (
    <section className="space-y-4">
      {services.length === 0 ? (
        <p className="rounded-lg bg-bg-subtle px-4 py-3 text-sm text-fg-muted">
          Nenhum serviço disponível no momento.
        </p>
      ) : (
        <ul className="space-y-2">
          {services.map((s) => {
            const selected = value === s.id
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onChange(s.id)}
                  aria-pressed={selected}
                  className="block w-full text-left"
                >
                  <Card
                    className={`shadow-xs transition-colors ${
                      selected
                        ? 'border-brand-primary bg-brand-primary/10 ring-1 ring-brand-primary/40'
                        : 'hover:bg-bg-subtle'
                    }`}
                  >
                    <CardContent className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="font-medium text-fg">{s.name}</p>
                        <p className="text-sm text-fg-muted">
                          {s.durationMinutes} min · {formatCentsToBrl(s.priceCents)}
                        </p>
                      </div>
                      {selected ? (
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary text-brand-primary-fg">
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                      ) : null}
                    </CardContent>
                  </Card>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className={`flex ${showBack ? 'justify-between' : 'justify-end'}`}>
        {showBack ? (
          <Button type="button" variant="secondary" onClick={onBack}>
            Voltar
          </Button>
        ) : null}
        <Button type="button" onClick={onNext} disabled={!value}>
          Continuar
        </Button>
      </div>
    </section>
  )
}
