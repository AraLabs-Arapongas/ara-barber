'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus, Clock, Hourglass, Link2, RefreshCw, User, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { STATUS_LABELS, STATUS_TONE, fullDateTimeLabel } from '@/lib/appointments/labels'
import type { AgendaAppointment } from '@/lib/appointments/queries'
import {
  cancelCustomerAppointment,
  cancelCustomerGroupBooking,
} from '@/lib/appointments/server-actions'
import { cacheAppointments } from '@/lib/appointments/client-cache'
import { groupBookings, type ComboGroup, type DisplayBooking } from '@/lib/appointments/grouping'
import { useCustomerTenant } from '@/components/customer/customer-tenant-provider'
import { useConfirm } from '@/components/ui/confirm/provider'

type Props = {
  appointments: AgendaAppointment[]
}

export function MyAppointmentsList({ appointments }: Props) {
  const { timezone: tenantTimezone, cancellationWindowHours } = useCustomerTenant()
  const router = useRouter()
  const confirm = useConfirm()
  const [tab, setTab] = useState<'futuros' | 'passados'>('futuros')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [nowMs] = useState(() => Date.now())

  useEffect(() => {
    cacheAppointments(appointments)
  }, [appointments])

  // Agrupa antes de filtrar — assim combo conta como 1 entry e
  // futuros/passados é decidido pelo startAt mínimo do combo.
  const grouped = useMemo(() => groupBookings(appointments), [appointments])

  const futuros = useMemo(
    () =>
      grouped.filter((b) => {
        const start = bookingStart(b)
        const status = bookingStatus(b)
        return start >= nowMs && status !== 'CANCELED' && status !== 'NO_SHOW'
      }),
    [grouped, nowMs],
  )
  const passados = useMemo(
    () =>
      grouped.filter((b) => {
        const start = bookingStart(b)
        const status = bookingStatus(b)
        return start < nowMs || status === 'CANCELED' || status === 'NO_SHOW'
      }),
    [grouped, nowMs],
  )

  const shown = tab === 'futuros' ? futuros : passados

  async function cancelSingle(id: string) {
    const ok = await confirm({
      title: 'Cancelar esta reserva?',
      description: 'Seu horário será liberado pra outros clientes.',
      confirmLabel: 'Cancelar reserva',
      cancelLabel: 'Voltar',
      destructive: true,
    })
    if (!ok) return
    setError(null)
    startTransition(async () => {
      const result = await cancelCustomerAppointment({ appointmentId: id })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  async function cancelCombo(groupId: string, serviceCount: number) {
    const ok = await confirm({
      title: `Cancelar combo de ${serviceCount} serviços?`,
      description: 'Todos os serviços do combo serão cancelados.',
      confirmLabel: 'Cancelar combo',
      cancelLabel: 'Voltar',
      destructive: true,
    })
    if (!ok) return
    setError(null)
    startTransition(async () => {
      const result = await cancelCustomerGroupBooking({ groupId })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <main className="mx-auto w-full max-w-xl px-5 pt-6 pb-16 sm:px-6">
      <div className="mb-5">
        <Link href="/book">
          <Button fullWidth>
            <CalendarPlus className="h-4 w-4" /> Nova reserva
          </Button>
        </Link>
      </div>

      <div className="mb-4 inline-flex rounded-lg bg-bg-subtle p-1">
        <button
          type="button"
          onClick={() => setTab('futuros')}
          className={`rounded-md px-4 py-1.5 text-[0.8125rem] font-medium transition-colors ${
            tab === 'futuros' ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg'
          }`}
        >
          Próximos ({futuros.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('passados')}
          className={`rounded-md px-4 py-1.5 text-[0.8125rem] font-medium transition-colors ${
            tab === 'passados' ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg'
          }`}
        >
          Histórico ({passados.length})
        </button>
      </div>

      {error ? (
        <Alert variant="error" className="mb-3">
          {error}
        </Alert>
      ) : null}

      {shown.length > 0 ? (
        <ul className="space-y-2">
          {shown.map((b) => {
            const start = bookingStart(b)
            const cutoff = start - cancellationWindowHours * 60 * 60 * 1000
            const canCancel =
              tab === 'futuros' &&
              ['SCHEDULED', 'CONFIRMED'].includes(bookingStatus(b)) &&
              nowMs <= cutoff

            if (b.kind === 'single') {
              return (
                <li key={`single-${b.appointment.id}`}>
                  <AppointmentCard
                    appt={b.appointment}
                    canCancel={canCancel}
                    pending={pending}
                    onCancel={() => cancelSingle(b.appointment.id)}
                    tenantTimezone={tenantTimezone}
                  />
                </li>
              )
            }
            return (
              <li key={`combo-${b.group.id}`}>
                <ComboCard
                  group={b.group}
                  canCancel={canCancel}
                  pending={pending}
                  onCancel={() => cancelCombo(b.group.id, b.group.segments.length)}
                  tenantTimezone={tenantTimezone}
                />
              </li>
            )
          })}
        </ul>
      ) : (
        <Card className="shadow-xs">
          <CardContent className="py-10 text-center">
            <p className="text-[0.9375rem] font-medium text-fg">
              {tab === 'futuros' ? 'Você ainda não tem reservas.' : 'Sem histórico ainda.'}
            </p>
            <p className="mt-1 text-[0.875rem] text-fg-muted">
              {tab === 'futuros'
                ? 'Agende seu próximo atendimento em poucos toques.'
                : 'Suas reservas concluídas aparecerão aqui.'}
            </p>
            {tab === 'futuros' ? (
              <Link
                href="/book"
                className="mt-4 inline-block text-[0.875rem] font-medium text-brand-primary hover:underline"
              >
                Fazer nova reserva
              </Link>
            ) : null}
          </CardContent>
        </Card>
      )}
    </main>
  )
}

function bookingStart(b: DisplayBooking): number {
  return new Date(b.kind === 'single' ? b.appointment.startAt : b.group.startAt).getTime()
}
function bookingStatus(b: DisplayBooking) {
  return b.kind === 'single' ? b.appointment.status : b.group.status
}

function AppointmentCard({
  appt,
  canCancel,
  pending,
  onCancel,
  tenantTimezone,
}: {
  appt: AgendaAppointment
  canCancel: boolean
  pending: boolean
  onCancel: () => void
  tenantTimezone: string
}) {
  return (
    <Card className="shadow-xs overflow-hidden">
      <Link
        href={`/meus-agendamentos/${appt.id}`}
        className="block transition-colors hover:bg-bg-subtle/40 focus-visible:bg-bg-subtle/40 focus-visible:outline-none"
      >
        <CardContent className="py-4">
          <div className="flex items-start justify-between gap-2">
            <p className="font-display text-[1.125rem] font-semibold leading-tight tracking-tight text-fg">
              {appt.serviceName ?? 'Serviço'}
            </p>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide ${STATUS_TONE[appt.status]}`}
            >
              {STATUS_LABELS[appt.status]}
            </span>
          </div>
          <dl className="mt-3 space-y-1 text-[0.875rem] text-fg-muted">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              {fullDateTimeLabel(appt.startAt, tenantTimezone)}
            </div>
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5" />
              {appt.professionalName || '—'}
            </div>
            <div className="flex items-center gap-2">
              <Hourglass className="h-3.5 w-3.5" />
              {Math.round(
                (new Date(appt.endAt).getTime() - new Date(appt.startAt).getTime()) / 60000,
              )}
              min
            </div>
          </dl>
        </CardContent>
      </Link>
      {canCancel ? (
        <div className="flex items-center gap-1 border-t border-border/60 px-2 py-1.5">
          <Link
            href={`/book?step=datetime&serviceIds=${appt.serviceId}&profIds=${appt.professionalId}`}
            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[0.8125rem] font-medium text-fg hover:bg-bg-subtle"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reagendar
          </Link>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[0.8125rem] font-medium text-error hover:bg-error-bg disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            {pending ? 'Cancelando...' : 'Cancelar'}
          </button>
        </div>
      ) : null}
    </Card>
  )
}

function ComboCard({
  group,
  canCancel,
  pending,
  onCancel,
  tenantTimezone,
}: {
  group: ComboGroup
  canCancel: boolean
  pending: boolean
  onCancel: () => void
  tenantTimezone: string
}) {
  const totalDuration = Math.round(
    (new Date(group.endAt).getTime() - new Date(group.startAt).getTime()) / 60000,
  )
  const services = group.segments.map((s) => s.serviceName ?? 'Serviço').join(' + ')
  const profs = Array.from(
    new Set(group.segments.map((s) => s.professionalName).filter(Boolean)),
  ).join(' e ')
  return (
    <Card className="shadow-xs overflow-hidden">
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 px-2 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-brand-primary">
              <Link2 className="h-3 w-3" aria-hidden="true" />
              Combo · {group.segments.length} serviços
            </span>
            <p className="mt-1.5 font-display text-[1.0625rem] font-semibold leading-tight tracking-tight text-fg">
              {services}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide ${STATUS_TONE[group.status]}`}
          >
            {STATUS_LABELS[group.status]}
          </span>
        </div>
        <dl className="mt-3 space-y-1 text-[0.875rem] text-fg-muted">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            {fullDateTimeLabel(group.startAt, tenantTimezone)}
          </div>
          {profs ? (
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5" />
              {profs}
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <Hourglass className="h-3.5 w-3.5" />
            {totalDuration} min
          </div>
        </dl>
      </CardContent>
      {canCancel ? (
        <div className="flex items-center gap-1 border-t border-border/60 px-2 py-1.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[0.8125rem] font-medium text-error hover:bg-error-bg disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            {pending ? 'Cancelando...' : 'Cancelar combo'}
          </button>
        </div>
      ) : null}
    </Card>
  )
}
