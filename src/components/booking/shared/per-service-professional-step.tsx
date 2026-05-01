'use client'

import { Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { BookingProfessional, BookingService } from '@/lib/booking/queries'
import { ANY_PROFESSIONAL, type SharedBookingContext } from './types'

/**
 * Multi-picker de profissional: 1 picker por serviço, na ordem.
 * Cliente escolhe quem faz cada serviço do combo (ou "Qualquer").
 *
 * Compacto: cada serviço vira um pequeno card com lista de profs
 * disponíveis (filtrados por professional_services). "Qualquer
 * profissional" é sempre a primeira opção em cada um.
 *
 * Continuar habilita quando TODOS os serviços têm escolha (não pode
 * ficar nenhum sem selecionar).
 */
export function PerServiceProfessionalStep({
  context,
  order,
  selections,
  onChange,
  onBack,
  onNext,
}: {
  context: SharedBookingContext
  /** Lista ordenada de serviceIds. */
  order: string[]
  /** Mapa serviceId → professionalId (UUID ou 'any'). */
  selections: Record<string, string>
  onChange: (serviceId: string, professionalId: string) => void
  onBack: () => void
  onNext: () => void
}) {
  const allChosen = order.every((sid) => Boolean(selections[sid]))

  return (
    <section className="space-y-5">
      {order.map((sid, idx) => {
        const svc = context.services.find((s) => s.id === sid)
        if (!svc) return null
        const candidates = candidatesFor(context, sid)
        const value = selections[sid] ?? null
        return (
          <div key={sid}>
            <p className="mb-2 px-1 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
              {idx + 1}. {svc.name}
            </p>
            <ProfessionalsList
              service={svc}
              candidates={candidates}
              value={value}
              onChange={(profId) => onChange(sid, profId)}
            />
          </div>
        )
      })}

      <div className="flex justify-between pt-2">
        <Button type="button" variant="secondary" onClick={onBack}>
          Voltar
        </Button>
        <Button type="button" onClick={onNext} disabled={!allChosen}>
          Continuar
        </Button>
      </div>
    </section>
  )
}

function ProfessionalsList({
  service: _service,
  candidates,
  value,
  onChange,
}: {
  service: BookingService
  candidates: BookingProfessional[]
  value: string | null
  onChange: (professionalId: string) => void
}) {
  if (candidates.length === 0) {
    return (
      <p className="rounded-lg bg-warning-bg px-4 py-3 text-sm text-warning">
        Nenhum profissional disponível pra este serviço.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      <li>
        <ProfCard
          label="Qualquer profissional"
          hint="Vamos sugerir o melhor horário"
          selected={value === ANY_PROFESSIONAL}
          onClick={() => onChange(ANY_PROFESSIONAL)}
        />
      </li>
      {candidates.map((p) => (
        <li key={p.id}>
          <ProfCard
            label={p.displayName ?? p.name}
            hint={p.phone ?? null}
            selected={value === p.id}
            onClick={() => onChange(p.id)}
          />
        </li>
      ))}
    </ul>
  )
}

function ProfCard({
  label,
  hint,
  selected,
  onClick,
}: {
  label: string
  hint: string | null
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
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
        <CardContent className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[0.9375rem] font-medium text-fg">{label}</p>
            {hint ? <p className="text-[0.8125rem] text-fg-muted">{hint}</p> : null}
          </div>
          {selected ? (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-primary text-brand-primary-fg">
              <Check className="h-3 w-3" aria-hidden="true" />
            </span>
          ) : null}
        </CardContent>
      </Card>
    </button>
  )
}

function candidatesFor(context: SharedBookingContext, serviceId: string): BookingProfessional[] {
  const ids = new Set(
    context.professionalServices
      .filter((ps) => ps.serviceId === serviceId)
      .map((ps) => ps.professionalId),
  )
  return context.professionals.filter((p) => ids.has(p.id))
}
