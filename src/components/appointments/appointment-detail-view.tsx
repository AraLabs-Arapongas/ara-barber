'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, Clock, Scissors, User } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { STATUS_LABELS, STATUS_TONE } from '@/lib/appointments/labels'
import { getCachedAppointment } from '@/lib/appointments/client-cache'
import { fetchCustomerAppointment } from '@/lib/appointments/server-actions'
import type { AgendaAppointment } from '@/lib/appointments/queries'
import { formatCentsToBrl } from '@/lib/money'
import { useCustomerTenant } from '@/components/customer/customer-tenant-provider'
import { CancelOwnAppointmentButton } from './cancel-own-appointment-button'

type Props = {
  id: string
}

export function AppointmentDetailView({ id }: Props) {
  const { timezone: tenantTimezone, cancellationWindowHours } = useCustomerTenant()
  const [appt, setAppt] = useState<AgendaAppointment | null>(() => {
    const cached = getCachedAppointment(id)
    return cached ?? null
  })
  const [missing, setMissing] = useState(false)
  const [nowMs] = useState(() => Date.now())

  useEffect(() => {
    if (appt) return
    let cancelled = false
    fetchCustomerAppointment(id).then((result) => {
      if (cancelled) return
      if (result.ok) setAppt(result.appointment)
      else setMissing(true)
    })
    return () => {
      cancelled = true
    }
  }, [id, appt])

  if (missing) notFound()
  if (!appt) return null // loading.tsx shape covers the gap

  const startMs = new Date(appt.startAt).getTime()
  const endMs = new Date(appt.endAt).getTime()
  const cutoffMs = startMs - cancellationWindowHours * 60 * 60 * 1000
  const canCancel =
    (appt.status === 'SCHEDULED' || appt.status === 'CONFIRMED') &&
    nowMs <= cutoffMs

  const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: tenantTimezone,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
  const timeFmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: tenantTimezone,
    hour: '2-digit',
    minute: '2-digit',
  })
  const durationMin = Math.round((endMs - startMs) / 60000)

  return (
    <main className="mx-auto w-full max-w-xl px-5 pt-6 pb-16 sm:px-6">
      <Link
        href="/meus-agendamentos"
        className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] text-fg-muted hover:text-fg"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Minhas reservas
      </Link>

      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Sua reserva
        </p>
        <h1 className="font-display text-[1.5rem] font-semibold leading-tight tracking-tight text-fg">
          {dateTimeFmt.format(new Date(appt.startAt))}
        </h1>
        <span
          className={`mt-2 inline-block rounded-full px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide ${STATUS_TONE[appt.status]}`}
        >
          {STATUS_LABELS[appt.status]}
        </span>
      </header>

      <Card className="mb-4 shadow-xs">
        <CardContent className="space-y-3 py-4">
          <InfoRow
            icon={<Scissors className="h-4 w-4" />}
            label="Serviço"
            value={appt.serviceName ?? undefined}
            sub={
              appt.priceCentsSnapshot !== null
                ? `${durationMin}min · ${formatCentsToBrl(appt.priceCentsSnapshot)}`
                : `${durationMin}min`
            }
          />
          <InfoRow
            icon={<User className="h-4 w-4" />}
            label="Profissional"
            value={appt.professionalName ?? undefined}
          />
          <InfoRow
            icon={<Clock className="h-4 w-4" />}
            label="Horário"
            value={`${timeFmt.format(new Date(appt.startAt))} → ${timeFmt.format(new Date(appt.endAt))}`}
          />
          {appt.notes ? (
            <div className="rounded-lg bg-bg-subtle p-3 text-[0.875rem] text-fg">
              <p className="mb-1 text-[0.6875rem] font-medium uppercase tracking-wide text-fg-subtle">
                Observações
              </p>
              {appt.notes}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {canCancel ? (
        <CancelOwnAppointmentButton
          appointmentId={appt.id}
          cancellationWindowHours={cancellationWindowHours}
        />
      ) : null}
    </main>
  )
}

function InfoRow({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value?: string
  sub?: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-bg-subtle text-fg-muted">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-fg-subtle">
          {label}
        </p>
        <p className="truncate font-medium text-fg">{value ?? '—'}</p>
        {sub ? <p className="truncate text-[0.8125rem] text-fg-muted">{sub}</p> : null}
      </div>
    </div>
  )
}
