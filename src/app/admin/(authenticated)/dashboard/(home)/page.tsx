import Link from 'next/link'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import {
  getAgendaForDay,
  getPendingConfirmations,
  type AgendaAppointment,
} from '@/lib/appointments/queries'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { AgendaEmptyState } from '@/components/agenda/empty-state'
import { STATUS_LABELS, STATUS_TONE } from '@/lib/appointments/labels'
import { RealtimeAppointmentsRefresh } from '@/components/appointments/realtime-refresh'
import { TenantLogo } from '@/components/branding/tenant-logo'
import {
  NotificationBell,
  type AttentionItem,
  type PendingAppointment,
} from '@/components/dashboard/notification-bell'
import { NotificationSound } from '@/components/dashboard/notification-sound'
import { hasNoSchedule } from '@/lib/admin/derivations'
import { WeekDayStrip } from '@/components/home/week-day-strip'

function todayISO(tenantTimezone: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tenantTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(new Date())
}

function isValidISODate(s: string | null | undefined): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
}

function shiftDateISO(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + deltaDays)
  return dt.toISOString().slice(0, 10)
}

function buildWeek(anchorISO: string): { weekDateISOs: string[]; sundayISO: string } {
  const [y, m, d] = anchorISO.split('-').map(Number)
  const anchor = new Date(Date.UTC(y, m - 1, d))
  const sunday = new Date(anchor)
  sunday.setUTCDate(sunday.getUTCDate() - anchor.getUTCDay())
  const weekDateISOs: string[] = []
  for (let i = 0; i < 7; i++) {
    const dt = new Date(sunday)
    dt.setUTCDate(dt.getUTCDate() + i)
    weekDateISOs.push(dt.toISOString().slice(0, 10))
  }
  return { weekDateISOs, sundayISO: weekDateISOs[0] }
}

function timeLabel(iso: string, tenantTimezone: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: tenantTimezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function DashboardHome({ searchParams }: PageProps) {
  const tenant = await getCurrentTenantOrNotFound()
  const supabase = await createClient()

  const sp = await searchParams
  const rawDate = Array.isArray(sp.date) ? sp.date[0] : sp.date
  const dateToday = todayISO(tenant.timezone)
  const dateISO = isValidISODate(rawDate) ? rawDate : dateToday
  const nowISO = new Date().toISOString()

  const [today, pending, profsRes, availRes] = await Promise.all([
    getAgendaForDay(tenant.id, dateISO, tenant.timezone),
    getPendingConfirmations(tenant.id, nowISO),
    supabase
      .from('professionals')
      .select('id, name')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true),
    supabase
      .from('professional_availability')
      .select('professional_id, weekday, start_time, end_time')
      .eq('tenant_id', tenant.id),
  ])

  const active = today.filter((a) => a.status !== 'CANCELED' && a.status !== 'NO_SHOW')

  const availability = (availRes.data ?? []).map((a) => ({ professionalId: a.professional_id }))
  const attention: AttentionItem[] = (profsRes.data ?? [])
    .filter((p) => hasNoSchedule(availability, p.id))
    .map((p) => ({
      kind: 'no-schedule',
      professionalId: p.id,
      professionalName: p.name,
    }))

  const pendingForBell: PendingAppointment[] = pending.map((a) => ({
    id: a.id,
    startAtISO: a.startAt,
    serviceName: a.serviceName,
    customerName: a.customerName,
    professionalName: a.professionalName,
  }))

  // Strip semanal: ancora na data selecionada (não em "hoje"), pra que
  // navegar entre semanas funcione em qualquer ponto. Tratamos YYYY-MM-DD
  // como data local; meio-dia UTC pra evitar off-by-one no nome do mês.
  const [hy, hm, hd] = dateISO.split('-').map(Number)
  const headerDateObj = new Date(Date.UTC(hy, hm - 1, hd, 12))
  const { weekDateISOs, sundayISO } = buildWeek(dateISO)
  const prevWeekDateISO = shiftDateISO(sundayISO, -7)
  const nextWeekDateISO = shiftDateISO(sundayISO, 7)
  const monthLabel = new Intl.DateTimeFormat('pt-BR', {
    timeZone: tenant.timezone,
    month: 'long',
  }).format(headerDateObj)

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-10 sm:px-8">
      <RealtimeAppointmentsRefresh tenantId={tenant.id} channelKey="staff-home" />

      {/* Header: logo + nome do negócio + sino. Inspirado no mockup mobile —
          straight to the point, sem cards de resumo. Stats e chart semanal
          moram em /relatorios. */}
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <TenantLogo logoUrl={tenant.logoUrl} name={tenant.name} size={55} />
          <div className="min-w-0 leading-none">
            <h1 className="truncate font-display text-[1.375rem] font-semibold leading-tight tracking-tight text-fg">
              {tenant.name}
            </h1>
            {tenant.tagline ? (
              <p className="mt-0.5 truncate text-[0.75rem] leading-tight text-fg-muted">
                {tenant.tagline}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <NotificationSound tenantId={tenant.id} />
          <NotificationBell
            pending={pendingForBell}
            attention={attention}
            tenantTimezone={tenant.timezone}
          />
        </div>
      </header>

      <WeekDayStrip
        weekDateISOs={weekDateISOs}
        todayISO={dateToday}
        selectedDateISO={dateISO}
        monthLabel={monthLabel}
        hrefBase="/admin/dashboard"
        prevWeekDateISO={prevWeekDateISO}
        nextWeekDateISO={nextWeekDateISO}
      />

      <div className="mt-6">
        <AgendaPreview
          appointments={active.sort(
            (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
          )}
          tenantTimezone={tenant.timezone}
          isToday={dateISO === dateToday}
        />
      </div>
    </main>
  )
}

function AgendaPreview({
  appointments,
  tenantTimezone,
  isToday,
}: {
  appointments: AgendaAppointment[]
  tenantTimezone: string
  isToday: boolean
}) {
  const sectionLabel = isToday ? 'Hoje' : 'Neste dia'
  if (appointments.length === 0) {
    return (
      <Card className="shadow-xs">
        <AgendaEmptyState
          title={isToday ? 'Nenhum agendamento hoje.' : 'Nenhum agendamento neste dia.'}
          description={
            isToday
              ? 'Aproveite pra atualizar serviços ou bloquear horários.'
              : 'Selecione outro dia ou crie um novo agendamento.'
          }
          action={
            <Link
              href="/admin/dashboard/agenda/novo"
              className="inline-flex items-center justify-center rounded-full bg-brand-primary px-5 py-2.5 text-[0.875rem] font-medium text-brand-primary-fg transition-colors hover:opacity-90"
            >
              Novo agendamento
            </Link>
          }
        />
      </Card>
    )
  }
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
          {sectionLabel}
        </h2>
        <Link href="/admin/dashboard/agenda" className="text-[0.75rem] text-fg-muted hover:text-fg">
          Ver agenda
        </Link>
      </div>
      <Card className="shadow-xs">
        <ul className="divide-y divide-border">
          {appointments.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-md bg-bg-subtle">
                <span className="font-display text-[0.9375rem] font-semibold text-fg">
                  {timeLabel(a.startAt, tenantTimezone)}
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-fg">{a.serviceName ?? 'Serviço'}</p>
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
