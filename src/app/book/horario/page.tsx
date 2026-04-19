'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useTenantSlug } from '@/components/mock/tenant-slug-provider'
import { useMockStore } from '@/lib/mock/store'
import { ENTITY } from '@/lib/mock/entities'
import { StepIndicator } from '@/components/book/step-indicator'
import { bookHrefWith, parseBookParams } from '@/lib/mock/booking-params'
import { cn } from '@/lib/utils'

type Slot = { time: string; professionalId: string }

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export default function BookStepTime() {
  const tenantSlug = useTenantSlug()
  const { data: services } = useMockStore(
    tenantSlug,
    ENTITY.services.key,
    ENTITY.services.schema,
    ENTITY.services.seed,
  )
  const { data: professionals } = useMockStore(
    tenantSlug,
    ENTITY.professionals.key,
    ENTITY.professionals.schema,
    ENTITY.professionals.seed,
  )
  const { data: businessHours } = useMockStore(
    tenantSlug,
    ENTITY.businessHours.key,
    ENTITY.businessHours.schema,
    ENTITY.businessHours.seed,
  )
  const { data: availability } = useMockStore(
    tenantSlug,
    ENTITY.availability.key,
    ENTITY.availability.schema,
    ENTITY.availability.seed,
  )
  const { data: blocks } = useMockStore(
    tenantSlug,
    ENTITY.availabilityBlocks.key,
    ENTITY.availabilityBlocks.schema,
    ENTITY.availabilityBlocks.seed,
  )
  const { data: appointments } = useMockStore(
    tenantSlug,
    ENTITY.appointments.key,
    ENTITY.appointments.schema,
    ENTITY.appointments.seed,
  )
  const sp = useSearchParams()
  const current = parseBookParams(sp ?? new URLSearchParams())
  const [nowMs] = useState(() => Date.now())

  const slots = useMemo((): Slot[] => {
    if (!current.serviceId || !current.date || !current.professionalId) return []
    const svc = services.find((s) => s.id === current.serviceId)
    if (!svc) return []

    const [y, m, d] = current.date.split('-').map(Number)
    const day = new Date(y, (m ?? 1) - 1, d ?? 1)
    const weekday = day.getDay()

    const salonHours = businessHours.find((h) => h.weekday === weekday)
    if (!salonHours || !salonHours.isOpen) return []
    const salonStart = timeToMinutes(salonHours.startTime)
    const salonEnd = timeToMinutes(salonHours.endTime)

    const candidatePros =
      current.professionalId === 'any'
        ? professionals.filter((p) => p.isActive).map((p) => p.id)
        : [current.professionalId!]

    const results: Slot[] = []
    const seen = new Set<string>()

    for (const profId of candidatePros) {
      const entries = availability.filter(
        (a) => a.professionalId === profId && a.weekday === weekday,
      )
      if (entries.length === 0) continue

      const profBlocks = blocks.filter((b) => b.professionalId === profId)
      const profAppts = appointments.filter(
        (a) =>
          a.professionalId === profId &&
          a.status !== 'CANCELED' &&
          a.status !== 'NO_SHOW' &&
          new Date(a.startAt).toDateString() === day.toDateString(),
      )

      for (const entry of entries) {
        const start = Math.max(timeToMinutes(entry.startTime), salonStart)
        const end = Math.min(timeToMinutes(entry.endTime), salonEnd)
        for (let t = start; t + svc.durationMinutes <= end; t += 30) {
          const slotStart = new Date(day)
          slotStart.setHours(Math.floor(t / 60), t % 60, 0, 0)
          const slotEnd = new Date(slotStart.getTime() + svc.durationMinutes * 60000)

          const blocked = profBlocks.some(
            (b) =>
              new Date(b.startAt).getTime() < slotEnd.getTime() &&
              new Date(b.endAt).getTime() > slotStart.getTime(),
          )
          if (blocked) continue

          const conflict = profAppts.some(
            (a) =>
              new Date(a.startAt).getTime() < slotEnd.getTime() &&
              new Date(a.endAt).getTime() > slotStart.getTime(),
          )
          if (conflict) continue

          if (slotStart.getTime() < nowMs) continue

          const key = minutesToTime(t)
          if (seen.has(key)) continue
          seen.add(key)
          results.push({ time: key, professionalId: profId })
        }
      }
    }
    results.sort((a, b) => a.time.localeCompare(b.time))
    return results
  }, [
    current.serviceId,
    current.date,
    current.professionalId,
    services,
    professionals,
    businessHours,
    availability,
    blocks,
    appointments,
    nowMs,
  ])

  if (!current.serviceId || !current.date || !current.professionalId) {
    return (
      <main className="mx-auto w-full max-w-xl px-5 py-10 sm:px-6">
        <p className="text-fg-muted">
          Finalize os passos anteriores.{' '}
          <Link href="/book" className="font-medium text-brand-primary hover:underline">
            Voltar
          </Link>
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-xl px-5 pt-6 pb-24 sm:px-6">
      <Link
        href={bookHrefWith('/book/data', current)}
        className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] text-fg-muted hover:text-fg"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Data
      </Link>

      <StepIndicator current={4} total={6} labels={['Serviço', 'Profissional', 'Data', 'Horário', 'Login', 'Confirmar']} />

      <h1 className="font-display text-[1.625rem] font-semibold leading-tight tracking-tight text-fg">
        Que horas?
      </h1>
      <p className="mt-1 mb-5 text-[0.9375rem] text-fg-muted">
        Horários disponíveis para este serviço.
      </p>

      {slots.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {slots.map((slot) => {
            const selected = current.time === slot.time
            return (
              <li key={`${slot.time}:${slot.professionalId}`}>
                <Link
                  href={bookHrefWith('/book/login', {
                    ...current,
                    time: slot.time,
                    professionalId: slot.professionalId,
                  })}
                  className={cn(
                    'flex items-center justify-center rounded-lg py-3 font-medium transition-colors',
                    selected
                      ? 'bg-brand-primary text-brand-primary-fg shadow-md'
                      : 'border border-border bg-surface text-fg hover:border-border-strong',
                  )}
                >
                  {slot.time}
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-[0.9375rem] text-fg-muted">
            Nenhum horário livre nesta data.
          </p>
          <Link
            href={bookHrefWith('/book/data', current)}
            className="mt-3 inline-block text-[0.875rem] font-medium text-brand-primary hover:underline"
          >
            Escolher outro dia
          </Link>
        </div>
      )}
    </main>
  )
}
