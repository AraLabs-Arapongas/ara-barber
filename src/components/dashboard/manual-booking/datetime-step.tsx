'use client'

import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { BookingContext } from '@/app/admin/(authenticated)/actions/booking-context'
import { computeSlots } from '@/lib/booking/slots'

function todayISOInTZ(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function DateTimeStep({
  context,
  serviceId,
  professionalId,
  value,
  onChange,
  onBack,
  onNext,
}: {
  context: BookingContext
  serviceId: string
  professionalId: string
  value: string | null
  onChange: (iso: string) => void
  onBack: () => void
  onNext: () => void
}) {
  const todayISO = todayISOInTZ(context.tenantTimezone)
  const [date, setDate] = useState<string>(todayISO)
  const service = context.services.find((s) => s.id === serviceId)

  const slots = useMemo(() => {
    if (!service) return []
    return computeSlots({
      serviceDurationMinutes: service.durationMinutes,
      dateISO: date,
      tenantTimezone: context.tenantTimezone,
      candidateProfessionalIds: [professionalId],
      businessHours: context.businessHours,
      availability: context.availability,
      blocks: context.blocks,
      existingAppointments: context.existingAppointments,
      now: new Date(),
    })
  }, [date, service, professionalId, context])

  return (
    <section className="space-y-4">
      <Input
        type="date"
        label="Data"
        value={date}
        min={todayISO}
        onChange={(e) => setDate(e.target.value)}
      />

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {slots.length === 0 ? (
          <p className="col-span-full rounded-lg bg-bg-subtle px-4 py-3 text-sm text-fg-muted">
            Sem horários disponíveis nesta data.
          </p>
        ) : null}
        {slots.map((s) => {
          const selected = value === s.startISO
          return (
            <button
              key={s.startISO}
              type="button"
              disabled={!s.available}
              onClick={() => onChange(s.startISO)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                selected
                  ? 'border-brand-primary bg-brand-primary text-brand-primary-fg'
                  : s.available
                    ? 'border-border bg-bg hover:bg-bg-subtle'
                    : 'cursor-not-allowed border-border bg-bg-subtle text-fg-subtle line-through'
              }`}
            >
              {s.time}
            </button>
          )
        })}
      </div>

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
