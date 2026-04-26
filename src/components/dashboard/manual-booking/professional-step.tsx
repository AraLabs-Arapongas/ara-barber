'use client'

import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { BookingContext } from '@/app/admin/(authenticated)/actions/booking-context'

export function ProfessionalStep({
  context,
  serviceId,
  value,
  onChange,
  onBack,
  onNext,
}: {
  context: BookingContext
  serviceId: string
  value: string | null
  onChange: (id: string) => void
  onBack: () => void
  onNext: () => void
}) {
  const candidates = useMemo(() => {
    const ids = new Set(
      context.professionalServices
        .filter((ps) => ps.serviceId === serviceId)
        .map((ps) => ps.professionalId),
    )
    return context.professionals.filter((p) => ids.has(p.id))
  }, [context, serviceId])

  return (
    <section className="space-y-4">
      {candidates.length === 0 ? (
        <p className="rounded-lg bg-warning-bg px-4 py-3 text-sm text-warning">
          Nenhum profissional vinculado a este serviço. Vincule em Equipe → [profissional] →
          Serviços.
        </p>
      ) : (
        <ul className="space-y-2">
          {candidates.map((p) => {
            const selected = value === p.id
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onChange(p.id)}
                  className="block w-full text-left"
                >
                  <Card
                    className={`shadow-xs transition-colors ${
                      selected ? 'border-brand-primary bg-brand-primary/5' : 'hover:bg-bg-subtle'
                    }`}
                  >
                    <CardContent className="py-3">
                      <p className="font-medium text-fg">{p.displayName ?? p.name}</p>
                      {p.phone ? <p className="text-sm text-fg-muted">{p.phone}</p> : null}
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
