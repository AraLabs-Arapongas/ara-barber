'use client'

import { useMemo } from 'react'
import { Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ANY_PROFESSIONAL, type SharedBookingContext } from './types'

export function ProfessionalStep({
  context,
  serviceId,
  value,
  onChange,
  onBack,
  onNext,
  allowAny = false,
}: {
  context: SharedBookingContext
  serviceId: string
  value: string | null
  onChange: (id: string) => void
  onBack: () => void
  onNext: () => void
  /** Quando true, mostra opção "Qualquer profissional" no topo. */
  allowAny?: boolean
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
          Nenhum profissional disponível pra este serviço no momento.
        </p>
      ) : (
        <ul className="space-y-2">
          {allowAny ? (
            <li>
              <button
                type="button"
                onClick={() => onChange(ANY_PROFESSIONAL)}
                aria-pressed={value === ANY_PROFESSIONAL}
                className="block w-full text-left"
              >
                <Card
                  className={`shadow-xs transition-colors ${
                    value === ANY_PROFESSIONAL
                      ? 'border-brand-primary bg-brand-primary/10 ring-1 ring-brand-primary/40'
                      : 'hover:bg-bg-subtle'
                  }`}
                >
                  <CardContent className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-medium text-fg">Qualquer profissional</p>
                      <p className="text-sm text-fg-muted">Vamos sugerir o melhor horário</p>
                    </div>
                    {value === ANY_PROFESSIONAL ? (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary text-brand-primary-fg">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    ) : null}
                  </CardContent>
                </Card>
              </button>
            </li>
          ) : null}
          {candidates.map((p) => {
            const selected = value === p.id
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onChange(p.id)}
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
                        <p className="font-medium text-fg">{p.displayName ?? p.name}</p>
                        {p.phone ? <p className="text-sm text-fg-muted">{p.phone}</p> : null}
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
