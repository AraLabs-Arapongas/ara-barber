'use client'

import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ANY_PROFESSIONAL_SENTINEL,
  computeComboSlots,
  type ComboService,
  type ComboSlot,
} from '@/lib/booking/slots'
import { ANY_PROFESSIONAL, type SharedBookingContext } from './types'

/**
 * DateTime step pra wizard cliente em modo combo (1 ou N serviços).
 * Diferente do `DateTimeStep` single-mode: usa `computeComboSlots` que
 * encadeia segments com buffer entre profs diferentes. Funciona tb
 * pra combo de 1 serviço (degenera).
 */
export function ComboDateTimeStep({
  context,
  order,
  selections,
  bufferMinutes,
  value,
  onChange,
  onBack,
  onNext,
  maxDateISO,
  initialDateISO,
  stepMinutes,
  minAdvanceHours,
}: {
  context: SharedBookingContext
  /** Ordem dos services. */
  order: string[]
  /** professionalId (ou 'any') por serviceId. */
  selections: Record<string, string>
  bufferMinutes: number
  /** Slot atualmente selecionado (chave: startISO). */
  value: ComboSlot | null
  onChange: (slot: ComboSlot | null) => void
  onBack: () => void
  onNext: () => void
  maxDateISO?: string
  initialDateISO?: string
  stepMinutes?: number
  minAdvanceHours?: number
}) {
  const todayISO = todayISOInTZ(context.tenantTimezone)
  const [date, setDate] = useState<string>(initialDateISO ?? todayISO)

  const services = useMemo<ComboService[]>(() => {
    return order
      .map((sid) => {
        const svc = context.services.find((s) => s.id === sid)
        if (!svc) return null
        const profSel = selections[sid] ?? ANY_PROFESSIONAL
        const candidates = context.professionalServices
          .filter((ps) => ps.serviceId === sid)
          .map((ps) => ps.professionalId)
        return {
          serviceId: sid,
          durationMinutes: svc.durationMinutes,
          professionalId: profSel === ANY_PROFESSIONAL ? ANY_PROFESSIONAL_SENTINEL : profSel,
          candidateProfessionalIds: candidates,
        } as ComboService
      })
      .filter((s): s is ComboService => s !== null)
  }, [order, selections, context.services, context.professionalServices])

  const slots = useMemo(() => {
    if (services.length === 0) return []
    return computeComboSlots({
      services,
      bufferMinutes,
      dateISO: date,
      tenantTimezone: context.tenantTimezone,
      businessHours: context.businessHours,
      availability: context.availability,
      blocks: context.blocks,
      existingAppointments: context.existingAppointments,
      now: new Date(),
      stepMinutes,
      minAdvanceHours,
    })
  }, [services, bufferMinutes, date, context, stepMinutes, minAdvanceHours])

  const isCombo = services.length > 1
  const totalDuration = services.reduce((sum, s) => sum + s.durationMinutes, 0)

  return (
    <section className="space-y-4">
      <Input
        type="date"
        label="Data"
        value={date}
        min={todayISO}
        max={maxDateISO}
        onChange={(e) => {
          setDate(e.target.value)
          onChange(null)
        }}
      />

      {isCombo ? (
        <p className="rounded-lg bg-bg-subtle px-3 py-2 text-[0.8125rem] text-fg-muted">
          Bloco de {formatDuration(totalDuration)} (sem incluir buffers entre profissionais).
        </p>
      ) : null}

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {slots.length === 0 ? (
          <p className="col-span-full rounded-lg bg-bg-subtle px-4 py-3 text-sm text-fg-muted">
            Sem horários disponíveis nesta data.
          </p>
        ) : null}
        {slots.map((s) => {
          const selected = value?.startISO === s.startISO
          return (
            <button
              key={s.startISO}
              type="button"
              onClick={() => onChange(s)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                selected
                  ? 'border-brand-primary bg-brand-primary text-brand-primary-fg'
                  : 'border-border bg-bg hover:bg-bg-subtle'
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

function todayISOInTZ(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h${m}`
}
