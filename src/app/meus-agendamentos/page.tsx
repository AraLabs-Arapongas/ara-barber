'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { CalendarPlus, Clock, LogOut, Scissors, User, X } from 'lucide-react'
import { useTenantSlug } from '@/components/mock/tenant-slug-provider'
import { useMockStore } from '@/lib/mock/store'
import { ENTITY } from '@/lib/mock/entities'
import type { Appointment } from '@/lib/mock/schemas'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { STATUS_LABELS, STATUS_TONE, fullDateTimeLabel, sortByStart } from '@/lib/mock/helpers'

export default function MeusAgendamentosPage() {
  const tenantSlug = useTenantSlug()
  const { data: appointments, setData: setAppointments } = useMockStore(
    tenantSlug,
    ENTITY.appointments.key,
    ENTITY.appointments.schema,
    ENTITY.appointments.seed,
  )
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
  const { data: session } = useMockStore(
    tenantSlug,
    ENTITY.currentCustomer.key,
    ENTITY.currentCustomer.schema,
    ENTITY.currentCustomer.seed,
  )

  const [tab, setTab] = useState<'futuros' | 'passados'>('futuros')
  const [nowMs] = useState(() => Date.now())

  const mine = useMemo(() => {
    if (!session.customerId) return []
    return appointments
      .filter((a) => a.customerId === session.customerId)
      .sort(sortByStart)
  }, [appointments, session.customerId])

  const futuros = mine.filter(
    (a) => new Date(a.startAt).getTime() >= nowMs && a.status !== 'CANCELED',
  )
  const passados = mine.filter(
    (a) => new Date(a.startAt).getTime() < nowMs || a.status === 'CANCELED',
  )

  const shown = tab === 'futuros' ? futuros : passados

  const svcById = new Map(services.map((s) => [s.id, s]))
  const proById = new Map(professionals.map((p) => [p.id, p]))

  function cancel(id: string) {
    if (!window.confirm('Cancelar este agendamento?')) return
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'CANCELED' } : a)),
    )
  }

  if (!session.customerId) {
    return (
      <main className="mx-auto w-full max-w-xl px-5 pt-8 pb-16 sm:px-6">
        <Card className="shadow-xs">
          <CardContent className="py-10 text-center">
            <p className="text-[0.9375rem] text-fg-muted">
              Entre pra ver seus agendamentos.
            </p>
            <Link
              href="/book/login"
              className="mt-4 inline-block text-[0.875rem] font-medium text-brand-primary hover:underline"
            >
              Fazer login
            </Link>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-xl px-5 pt-6 pb-16 sm:px-6">
      <div className="mb-5 flex gap-2">
        <Link href="/book" className="flex-1">
          <Button variant="secondary" fullWidth>
            <CalendarPlus className="h-4 w-4" /> Novo agendamento
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

      {shown.length > 0 ? (
        <ul className="space-y-2">
          {shown.map((a) => (
            <li key={a.id}>
              <AppointmentCard
                appt={a}
                svc={svcById.get(a.serviceId)}
                pro={proById.get(a.professionalId)}
                canCancel={tab === 'futuros' && a.status !== 'CANCELED'}
                onCancel={() => cancel(a.id)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <Card className="shadow-xs">
          <CardContent className="py-10 text-center">
            <p className="text-[0.9375rem] text-fg-muted">
              {tab === 'futuros'
                ? 'Nenhum agendamento marcado.'
                : 'Sem histórico ainda.'}
            </p>
          </CardContent>
        </Card>
      )}
    </main>
  )
}

function AppointmentCard({
  appt,
  svc,
  pro,
  canCancel,
  onCancel,
}: {
  appt: Appointment
  svc?: { name: string; durationMinutes: number }
  pro?: { name: string; displayName: string | null }
  canCancel: boolean
  onCancel: () => void
}) {
  return (
    <Card className="shadow-xs">
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-display text-[1.125rem] font-semibold leading-tight tracking-tight text-fg">
            {svc?.name ?? 'Serviço'}
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
            {fullDateTimeLabel(appt.startAt)}
          </div>
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5" />
            {pro?.displayName || pro?.name || '—'}
          </div>
          {svc ? (
            <div className="flex items-center gap-2">
              <Scissors className="h-3.5 w-3.5" />
              {svc.durationMinutes}min
            </div>
          ) : null}
        </dl>
        {canCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="mt-3 inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[0.8125rem] text-error hover:bg-error-bg"
          >
            <X className="h-3.5 w-3.5" />
            Cancelar
          </button>
        ) : null}
      </CardContent>
    </Card>
  )
}
