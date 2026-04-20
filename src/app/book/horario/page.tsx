import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import {
  getAppointmentsInRange,
  getAvailabilityBlocksInRange,
  getBusinessHours,
  getProfessionalAvailability,
  getProfessionalsForService,
  getServiceById,
} from '@/lib/booking/queries'
import { StepIndicator } from '@/components/book/step-indicator'
import { bookHrefWith, parseBookParams } from '@/lib/booking/params'
import { computeSlots, dateTimeInTenantTZ } from '@/lib/booking/slots'
import { cn } from '@/lib/utils'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function BookStepTime({ searchParams }: PageProps) {
  const tenant = await getCurrentTenantOrNotFound()
  const sp = await searchParams
  const current = parseBookParams(sp)

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

  const svc = await getServiceById(tenant.id, current.serviceId)
  if (!svc) {
    return (
      <main className="mx-auto w-full max-w-xl px-5 py-10 sm:px-6">
        <p className="text-fg-muted">Serviço não disponível.</p>
      </main>
    )
  }

  const eligiblePros = await getProfessionalsForService(tenant.id, current.serviceId)
  const candidateIds =
    current.professionalId === 'any'
      ? eligiblePros.map((p) => p.id)
      : [current.professionalId]

  const dayStart = dateTimeInTenantTZ(current.date, '00:00', tenant.timezone)
  const dayEnd = dateTimeInTenantTZ(current.date, '23:59', tenant.timezone)

  const [businessHours, availability, blocks, existing] = await Promise.all([
    getBusinessHours(tenant.id),
    getProfessionalAvailability(tenant.id, candidateIds),
    getAvailabilityBlocksInRange(
      tenant.id,
      candidateIds,
      dayStart.toISOString(),
      dayEnd.toISOString(),
    ),
    getAppointmentsInRange(
      tenant.id,
      candidateIds,
      dayStart.toISOString(),
      dayEnd.toISOString(),
    ),
  ])

  const slots = computeSlots({
    serviceDurationMinutes: svc.durationMinutes,
    dateISO: current.date,
    tenantTimezone: tenant.timezone,
    candidateProfessionalIds: candidateIds,
    businessHours,
    availability,
    blocks,
    existingAppointments: existing,
    now: new Date(),
  })

  return (
    <main className="mx-auto w-full max-w-xl px-5 pt-6 pb-24 sm:px-6">
      <Link
        href={bookHrefWith('/book/data', current)}
        className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] text-fg-muted hover:text-fg"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Data
      </Link>

      <StepIndicator
        current={4}
        total={6}
        labels={['Serviço', 'Profissional', 'Data', 'Horário', 'Login', 'Confirmar']}
      />

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
            if (!slot.available) {
              return (
                <li key={slot.time}>
                  <div
                    aria-disabled="true"
                    className={cn(
                      'flex items-center justify-center rounded-lg py-3 font-medium',
                      'cursor-not-allowed border border-border bg-bg-subtle text-fg-subtle line-through opacity-60',
                    )}
                    title="Indisponível"
                  >
                    {slot.time}
                  </div>
                </li>
              )
            }
            return (
              <li key={slot.time}>
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
