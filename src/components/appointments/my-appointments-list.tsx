'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus, Clock, Hourglass, LogOut, User, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { STATUS_LABELS, STATUS_TONE, fullDateTimeLabel } from '@/lib/appointments/labels'
import type { AgendaAppointment } from '@/lib/appointments/queries'
import { cancelCustomerAppointment } from '@/lib/appointments/server-actions'
import { cacheAppointments } from '@/lib/appointments/client-cache'
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

  const futuros = useMemo(
    () =>
      appointments.filter(
        (a) =>
          new Date(a.startAt).getTime() >= nowMs &&
          a.status !== 'CANCELED' &&
          a.status !== 'NO_SHOW',
      ),
    [appointments, nowMs],
  )
  const passados = useMemo(
    () =>
      appointments.filter(
        (a) =>
          new Date(a.startAt).getTime() < nowMs ||
          a.status === 'CANCELED' ||
          a.status === 'NO_SHOW',
      ),
    [appointments, nowMs],
  )

  const shown = tab === 'futuros' ? futuros : passados

  async function cancel(id: string) {
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

  return (
    <main className="mx-auto w-full max-w-xl px-5 pt-6 pb-16 sm:px-6">
      <div className="mb-5 flex gap-2">
        <Link href="/book" className="flex-1">
          <Button variant="secondary" fullWidth>
            <CalendarPlus className="h-4 w-4" /> Nova reserva
          </Button>
        </Link>
        <form action="/auth/logout" method="post">
          <Button variant="ghost" size="md" type="submit" aria-label="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </form>
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
          {shown.map((a) => {
            const startMs = new Date(a.startAt).getTime()
            const cutoff = startMs - cancellationWindowHours * 60 * 60 * 1000
            const canCancel =
              tab === 'futuros' &&
              (a.status === 'SCHEDULED' || a.status === 'CONFIRMED') &&
              nowMs <= cutoff
            return (
              <li key={a.id}>
                <AppointmentCard
                  appt={a}
                  canCancel={canCancel}
                  pending={pending}
                  onCancel={() => cancel(a.id)}
                  tenantTimezone={tenantTimezone}
                />
              </li>
            )
          })}
        </ul>
      ) : (
        <Card className="shadow-xs">
          <CardContent className="py-10 text-center">
            <p className="text-[0.9375rem] text-fg-muted">
              {tab === 'futuros' ? 'Nenhuma reserva marcada.' : 'Sem histórico ainda.'}
            </p>
          </CardContent>
        </Card>
      )}
    </main>
  )
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
        <div className="border-t border-border/60 px-4 py-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[0.8125rem] text-error hover:bg-error-bg disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            {pending ? 'Cancelando...' : 'Cancelar'}
          </button>
        </div>
      ) : null}
    </Card>
  )
}
