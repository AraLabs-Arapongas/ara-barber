'use client'

import { Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { BookingService } from '@/lib/booking/queries'
import { formatCentsToBrl } from '@/lib/money'

/**
 * Multi-select de serviços pra wizard cliente. Cliente pode escolher
 * 1 ou N serviços; quando N>1 vira combo. Footer sticky agrega
 * quantidade + duração + preço.
 *
 * Uso só do customer wizard. Staff usa `ServiceStep` (single-select).
 */
export function MultiServiceStep({
  services,
  values,
  onToggle,
  onNext,
}: {
  services: BookingService[]
  values: string[]
  onToggle: (id: string) => void
  onNext: () => void
}) {
  const selectedSvcs = services.filter((s) => values.includes(s.id))
  const totalDuration = selectedSvcs.reduce((sum, s) => sum + s.durationMinutes, 0)
  const totalPrice = selectedSvcs.reduce((sum, s) => sum + s.priceCents, 0)
  const count = selectedSvcs.length

  return (
    <section className="space-y-4 pb-20">
      {services.length === 0 ? (
        <p className="rounded-lg bg-bg-subtle px-4 py-3 text-sm text-fg-muted">
          Nenhum serviço disponível no momento.
        </p>
      ) : (
        <ul className="space-y-2">
          {services.map((s) => {
            const selected = values.includes(s.id)
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onToggle(s.id)}
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

      {/* Footer sticky com summary (só aparece quando há ≥1 selecionado).
          Posicionado acima da bottom tab bar do cliente (z-30 < z-40 da tab).
          Padding-bottom pra não cobrir conteúdo (`pb-20` na section). */}
      {count > 0 ? (
        <div className="fixed inset-x-0 bottom-[64px] z-30 border-t border-border bg-surface/95 px-5 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
                {count === 1 ? '1 serviço' : `${count} serviços`}
              </p>
              <p className="text-[0.875rem] font-medium text-fg">
                {formatDuration(totalDuration)} · {formatCentsToBrl(totalPrice)}
              </p>
            </div>
            <Button type="button" onClick={onNext}>
              Continuar
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h${m}`
}
