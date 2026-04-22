import Link from 'next/link'
import { ArrowRight, BellRing, Calendar, TrendingUp } from 'lucide-react'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import {
  getAgendaForDay,
  getPendingConfirmations,
  type AgendaAppointment,
} from '@/lib/appointments/queries'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { STATUS_LABELS, STATUS_TONE } from '@/lib/appointments/labels'
import { formatCentsToBrl } from '@/lib/money'
import { ConfirmAppointmentInline } from '@/components/dashboard/confirm-appointment-inline'

function todayISO(tenantTimezone: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tenantTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(new Date())
}

function timeLabel(iso: string, tenantTimezone: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: tenantTimezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export default async function DashboardHome() {
  const tenant = await getCurrentTenantOrNotFound()
  const supabase = await createClient()

  const dateISO = todayISO(tenant.timezone)
  const nowISO = new Date().toISOString()
  const [today, pending, svcRes] = await Promise.all([
    getAgendaForDay(tenant.id, dateISO, tenant.timezone),
    getPendingConfirmations(tenant.id, nowISO),
    supabase.from('services').select('id, price_cents').eq('tenant_id', tenant.id),
  ])
  const priceById = new Map((svcRes.data ?? []).map((s) => [s.id, s.price_cents]))

  // eslint-disable-next-line react-hooks/purity -- server component, precisa saber o "agora"
  const now = Date.now()
  const active = today.filter(
    (a) => a.status !== 'CANCELED' && a.status !== 'NO_SHOW',
  )
  const next = active
    .filter((a) => new Date(a.startAt).getTime() >= now - 30 * 60000)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0]

  const todayRevenueCents = active.reduce(
    (sum, a) => sum + (a.priceCentsSnapshot ?? priceById.get(a.serviceId) ?? 0),
    0,
  )
  const completed = today.filter((a) => a.status === 'COMPLETED').length

  const headerDate = new Intl.DateTimeFormat('pt-BR', {
    timeZone: tenant.timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Hoje
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          {headerDate}
        </h1>
      </header>

      {next ? (
        <Card className="mb-4 overflow-hidden">
          <div className="bg-brand-primary/10 px-5 py-3 text-[0.75rem] font-medium uppercase tracking-[0.14em] text-brand-primary">
            Próximo atendimento
          </div>
          <CardContent className="pt-4 pb-5">
            <p className="text-[0.8125rem] text-fg-muted">
              {timeLabel(next.startAt, tenant.timezone)}
            </p>
            <p className="mt-1 font-display text-[1.375rem] font-semibold leading-tight tracking-tight text-fg">
              {next.serviceName ?? 'Serviço'}
            </p>
            <p className="mt-0.5 text-[0.875rem] text-fg-muted">
              com {next.professionalName ?? 'profissional'} ·{' '}
              {next.customerName ?? 'cliente'}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Calendar className="h-4 w-4" />}
          label="Agenda hoje"
          value={String(active.length)}
          hint={`${completed} já concluídos`}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Previsto"
          value={formatCentsToBrl(todayRevenueCents)}
          hint="somando serviços"
        />
      </div>

      <QuickActions />

      <PendingConfirmations
        appointments={pending}
        tenantTimezone={tenant.timezone}
      />

      <AgendaPreview
        appointments={active.sort(
          (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
        )}
        tenantTimezone={tenant.timezone}
      />
    </main>
  )
}

function PendingConfirmations({
  appointments,
  tenantTimezone,
}: {
  appointments: AgendaAppointment[]
  tenantTimezone: string
}) {
  if (appointments.length === 0) return null
  const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: tenantTimezone,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="flex items-center gap-1.5 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-warning">
          <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
          Precisam confirmar ({appointments.length})
        </h2>
      </div>
      <Card className="shadow-xs">
        <ul className="divide-y divide-border">
          {appointments.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-fg">
                  {a.serviceName ?? 'Serviço'}
                </p>
                <p className="truncate text-[0.8125rem] text-fg-muted">
                  {dateTimeFmt.format(new Date(a.startAt))} ·{' '}
                  {a.customerName ?? 'cliente'}
                  {a.professionalName ? ` · ${a.professionalName}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ConfirmAppointmentInline appointmentId={a.id} />
                <Link
                  href={`/salon/dashboard/agenda/${a.id}`}
                  className="text-[0.75rem] text-fg-muted hover:text-fg"
                  aria-label="Ver detalhe do agendamento"
                >
                  Ver
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  )
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint: string
}) {
  return (
    <Card className="shadow-xs">
      <CardContent className="py-4">
        <div className="mb-2 flex items-center gap-2 text-fg-muted">
          {icon}
          <span className="text-[0.75rem] font-medium uppercase tracking-[0.14em]">
            {label}
          </span>
        </div>
        <p className="font-display text-[1.5rem] font-semibold leading-tight tracking-tight text-fg">
          {value}
        </p>
        <p className="text-[0.75rem] text-fg-muted">{hint}</p>
      </CardContent>
    </Card>
  )
}

function QuickActions() {
  const actions = [
    { href: '/salon/dashboard/agenda', label: 'Abrir agenda', icon: Calendar },
    { href: '/salon/dashboard/mais', label: 'Ajustes do negócio', icon: ArrowRight },
  ] as const
  return (
    <div className="mt-4 flex gap-2">
      {actions.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="flex flex-1 items-center justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-[0.875rem] font-medium text-fg shadow-xs transition-colors hover:bg-bg-subtle"
        >
          {a.label}
          <a.icon className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
        </Link>
      ))}
    </div>
  )
}

function AgendaPreview({
  appointments,
  tenantTimezone,
}: {
  appointments: AgendaAppointment[]
  tenantTimezone: string
}) {
  if (appointments.length === 0) return null
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
          Próximos
        </h2>
        <Link
          href="/salon/dashboard/agenda"
          className="text-[0.75rem] text-fg-muted hover:text-fg"
        >
          Ver agenda
        </Link>
      </div>
      <Card className="shadow-xs">
        <ul className="divide-y divide-border">
          {appointments.slice(0, 5).map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-md bg-bg-subtle">
                <span className="font-display text-[0.9375rem] font-semibold text-fg">
                  {timeLabel(a.startAt, tenantTimezone)}
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-fg">
                  {a.serviceName ?? 'Serviço'}
                </p>
                <p className="truncate text-[0.8125rem] text-fg-muted">
                  {a.professionalName ?? 'profissional'} · {a.customerName ?? 'cliente'}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide ${STATUS_TONE[a.status]}`}
              >
                {STATUS_LABELS[a.status]}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  )
}
