'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { ChevronLeft, Clock, Scissors, User, Trash2 } from 'lucide-react'
import { useTenantSlug } from '@/components/mock/tenant-slug-provider'
import { useMockStore } from '@/lib/mock/store'
import { ENTITY } from '@/lib/mock/entities'
import type { AppointmentStatus } from '@/lib/mock/schemas'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  STATUS_LABELS,
  STATUS_TONE,
  STATUS_TRANSITIONS,
  fullDateTimeLabel,
  timeLabel,
} from '@/lib/mock/helpers'
import { formatCentsToBrl } from '@/lib/money'

const ACTION_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: 'Reabrir',
  CONFIRMED: 'Confirmar',
  IN_PROGRESS: 'Iniciar',
  COMPLETED: 'Finalizar',
  CANCELED: 'Cancelar',
  NO_SHOW: 'Não veio',
}

const ACTION_VARIANT: Record<AppointmentStatus, 'primary' | 'secondary' | 'destructive'> = {
  SCHEDULED: 'secondary',
  CONFIRMED: 'primary',
  IN_PROGRESS: 'primary',
  COMPLETED: 'primary',
  CANCELED: 'destructive',
  NO_SHOW: 'destructive',
}

export default function AppointmentDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const tenantSlug = useTenantSlug()

  const { data: appointments, setData: setAppointments } = useMockStore(
    tenantSlug,
    ENTITY.appointments.key,
    ENTITY.appointments.schema,
    ENTITY.appointments.seed,
  )
  const { data: professionals } = useMockStore(
    tenantSlug,
    ENTITY.professionals.key,
    ENTITY.professionals.schema,
    ENTITY.professionals.seed,
  )
  const { data: services } = useMockStore(
    tenantSlug,
    ENTITY.services.key,
    ENTITY.services.schema,
    ENTITY.services.seed,
  )
  const { data: customers } = useMockStore(
    tenantSlug,
    ENTITY.customers.key,
    ENTITY.customers.schema,
    ENTITY.customers.seed,
  )

  const appt = useMemo(() => appointments.find((a) => a.id === params.id), [appointments, params.id])

  if (!appt) {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
        <Link
          href="/salon/dashboard/agenda"
          className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] text-fg-muted hover:text-fg"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Agenda
        </Link>
        <Card className="shadow-xs">
          <CardContent className="py-10 text-center">
            <p className="text-[0.9375rem] text-fg-muted">Agendamento não encontrado.</p>
          </CardContent>
        </Card>
      </main>
    )
  }

  const prof = professionals.find((p) => p.id === appt.professionalId)
  const svc = services.find((s) => s.id === appt.serviceId)
  const cust = customers.find((c) => c.id === appt.customerId)
  const transitions = STATUS_TRANSITIONS[appt.status]

  function moveTo(next: AppointmentStatus) {
    setAppointments((prev) =>
      prev.map((a) => (a.id === appt!.id ? { ...a, status: next } : a)),
    )
  }

  function remove() {
    if (!window.confirm('Excluir este agendamento?')) return
    setAppointments((prev) => prev.filter((a) => a.id !== appt!.id))
    router.push('/salon/dashboard/agenda')
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <Link
        href="/salon/dashboard/agenda"
        className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] text-fg-muted hover:text-fg"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Agenda
      </Link>

      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Agendamento
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          {fullDateTimeLabel(appt.startAt)}
        </h1>
        <span
          className={`mt-2 inline-block rounded-full px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide ${STATUS_TONE[appt.status]}`}
        >
          {STATUS_LABELS[appt.status]}
        </span>
      </header>

      <Card className="mb-4 shadow-xs">
        <CardContent className="space-y-3 py-4">
          <InfoRow icon={<Scissors className="h-4 w-4" />} label="Serviço" value={svc?.name} sub={svc ? `${svc.durationMinutes}min · ${formatCentsToBrl(svc.priceCents)}` : undefined} />
          <InfoRow icon={<User className="h-4 w-4" />} label="Profissional" value={prof?.displayName || prof?.name} />
          <InfoRow icon={<User className="h-4 w-4" />} label="Cliente" value={cust?.name ?? cust?.email ?? '—'} sub={cust?.phone ?? undefined} />
          <InfoRow
            icon={<Clock className="h-4 w-4" />}
            label="Horário"
            value={`${timeLabel(appt.startAt)} → ${timeLabel(appt.endAt)}`}
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

      {transitions.length > 0 ? (
        <section className="mb-4">
          <h2 className="mb-2 px-1 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
            Ações
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {transitions.map((next) => (
              <Button
                key={next}
                type="button"
                variant={ACTION_VARIANT[next]}
                onClick={() => moveTo(next)}
              >
                {ACTION_LABELS[next]}
              </Button>
            ))}
          </div>
        </section>
      ) : null}

      <button
        type="button"
        onClick={remove}
        className="mt-2 inline-flex items-center gap-2 rounded-md px-3 py-2 text-[0.8125rem] text-error hover:bg-error-bg"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Excluir agendamento
      </button>
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
