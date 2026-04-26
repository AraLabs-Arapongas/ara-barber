'use client'

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
}: {
  services: BookingService[]
  value: string | null
  onChange: (id: string) => void
  onBack: () => void
  onNext: () => void
}) {
  return (
    <section className="space-y-4">
      {services.length === 0 ? (
        <p className="rounded-lg bg-bg-subtle px-4 py-3 text-sm text-fg-muted">
          Nenhum serviço ativo. Cadastre um em Serviços antes de continuar.
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
                  className="block w-full text-left"
                >
                  <Card
                    className={`shadow-xs transition-colors ${
                      selected ? 'border-brand-primary bg-brand-primary/5' : 'hover:bg-bg-subtle'
                    }`}
                  >
                    <CardContent className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium text-fg">{s.name}</p>
                        <p className="text-sm text-fg-muted">
                          {s.durationMinutes} min · {formatCentsToBrl(s.priceCents)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex justify-between">
        <Button type="button" variant="secondary" onClick={onBack}>
          Voltar
        </Button>
        <Button type="button" onClick={onNext} disabled={!value}>
          Continuar
        </Button>
      </div>
    </section>
  )
}
