import Link from 'next/link'
import { BellRing, Calendar, CheckCircle2, Clock } from 'lucide-react'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { getTenantBookingUrl } from '@/lib/tenant/public-url'
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
import { RealtimeAgendaRefresh } from '@/components/agenda/realtime-refresh'
import { QuickActions } from '@/components/home/quick-actions'
import { AttentionSection, type AttentionItem } from '@/components/home/attention-section'
import { MoneyStatCard } from '@/components/home/money-stat-card'
import { WeekAgendaStrip, type WeekDay } from '@/components/home/week-agenda-strip'
import { hasNoSchedule, isLate, lateMinutes } from '@/lib/admin/derivations'
import { dateTimeInTenantTZ } from '@/lib/booking/slots'

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

  // Calcula domingo→sábado da semana atual em TZ do tenant. Faz aritmética
  // de calendário em UTC tratando YYYY-MM-DD como datas puras (sem horário),
  // o que evita off-by-one em virada de dia.
  const [yyyy, mm, dd] = dateISO.split('-').map(Number)
  const todayUTC = new Date(Date.UTC(yyyy, mm - 1, dd))
  const sundayUTC = new Date(todayUTC)
  sundayUTC.setUTCDate(sundayUTC.getUTCDate() - todayUTC.getUTCDay())
  const weekDateISOs: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(sundayUTC)
    d.setUTCDate(d.getUTCDate() + i)
    weekDateISOs.push(d.toISOString().slice(0, 10))
  }
  const weekStartUTC = dateTimeInTenantTZ(weekDateISOs[0], '00:00', tenant.timezone).toISOString()
  const weekEndUTC = dateTimeInTenantTZ(weekDateISOs[6], '23:59', tenant.timezone).toISOString()

  const [today, pending, svcRes, profsRes, availRes, weekApptsRes] = await Promise.all([
    getAgendaForDay(tenant.id, dateISO, tenant.timezone),
    getPendingConfirmations(tenant.id, nowISO),
    supabase.from('services').select('id, price_cents').eq('tenant_id', tenant.id),
    supabase
      .from('professionals')
      .select('id, name')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true),
    supabase
      .from('professional_availability')
      .select('professional_id, weekday, start_time, end_time')
      .eq('tenant_id', tenant.id),
    supabase
      .from('appointments')
      .select('start_at, service_id, price_cents_snapshot')
      .eq('tenant_id', tenant.id)
      .not('status', 'in', '(CANCELED,NO_SHOW)')
      .gte('start_at', weekStartUTC)
      .lte('start_at', weekEndUTC),
  ])
  const priceById = new Map((svcRes.data ?? []).map((s) => [s.id, s.price_cents]))

  // Agrupa agendamentos da semana por data em TZ do tenant.
  const weekFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tenant.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const weekByDate = new Map<string, { count: number; revenueCents: number }>()
  for (const date of weekDateISOs) weekByDate.set(date, { count: 0, revenueCents: 0 })
  for (const a of weekApptsRes.data ?? []) {
    const dateInTZ = weekFmt.format(new Date(a.start_at))
    const entry = weekByDate.get(dateInTZ)
    if (!entry) continue
    entry.count += 1
    entry.revenueCents += a.price_cents_snapshot ?? priceById.get(a.service_id) ?? 0
  }
  const weekDays: WeekDay[] = weekDateISOs.map((d) => {
    const entry = weekByDate.get(d) ?? { count: 0, revenueCents: 0 }
    return { dateISO: d, count: entry.count, revenueCents: entry.revenueCents }
  })

  // eslint-disable-next-line react-hooks/purity -- server component, precisa saber o "agora"
  const now = Date.now()
  const nowDate = new Date(now)
  const active = today.filter((a) => a.status !== 'CANCELED' && a.status !== 'NO_SHOW')
  const next = active
    .filter((a) => new Date(a.startAt).getTime() >= now - 30 * 60000)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0]

  const todayRevenueCents = active.reduce(
    (sum, a) => sum + (a.priceCentsSnapshot ?? priceById.get(a.serviceId) ?? 0),
    0,
  )
  const completedRevenueCents = active
    .filter((a) => a.status === 'COMPLETED')
    .reduce((sum, a) => sum + (a.priceCentsSnapshot ?? priceById.get(a.serviceId) ?? 0), 0)
  const completed = today.filter((a) => a.status === 'COMPLETED').length
  const canceled = today.filter((a) => a.status === 'CANCELED' || a.status === 'NO_SHOW').length
  const pendingActive = active.filter((a) => a.status === 'SCHEDULED' || a.status === 'CONFIRMED')
  const lateAppointments = active.filter((a) =>
    isLate({ status: a.status, startAt: a.startAt }, nowDate),
  )

  const lateItems: AttentionItem[] = lateAppointments.map((a) => ({
    kind: 'late',
    appointmentId: a.id,
    customerName: a.customerName ?? 'Cliente',
    minutes: lateMinutes({ status: a.status, startAt: a.startAt }, nowDate),
  }))

  const availability = (availRes.data ?? []).map((a) => ({
    professionalId: a.professional_id,
  }))
  const noScheduleItems: AttentionItem[] = (profsRes.data ?? [])
    .filter((p) => hasNoSchedule(availability, p.id))
    .map((p) => ({
      kind: 'no-schedule',
      professionalId: p.id,
      professionalName: p.name,
    }))

  const attentionItems: AttentionItem[] = [...lateItems, ...noScheduleItems]
  const publicUrl = await getTenantBookingUrl(tenant)

  const headerDate = new Intl.DateTimeFormat('pt-BR', {
    timeZone: tenant.timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <RealtimeAgendaRefresh tenantId={tenant.id} />
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
              com {next.professionalName ?? 'profissional'} · {next.customerName ?? 'cliente'}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Calendar className="h-4 w-4" />}
          label="Agenda hoje"
          value={String(active.length)}
          hint={`${completed} ${completed === 1 ? 'concluído' : 'concluídos'}`}
        />
        <MoneyStatCard
          label="Previsto"
          value={formatCentsToBrl(todayRevenueCents)}
          hint={`${formatCentsToBrl(completedRevenueCents)} já feito`}
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Pendentes"
          value={String(pendingActive.length)}
          hint={
            lateAppointments.length > 0
              ? `${lateAppointments.length} ${lateAppointments.length === 1 ? 'atrasado' : 'atrasados'}`
              : 'no horário'
          }
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Concluídos"
          value={String(completed)}
          hint={`${canceled} ${canceled === 1 ? 'cancelado/falta' : 'cancelados/faltas'}`}
        />
      </div>

      <QuickActions publicUrl={publicUrl} />

      <PendingConfirmations appointments={pending} tenantTimezone={tenant.timezone} />

      <AttentionSection items={attentionItems} />

      <WeekAgendaStrip days={weekDays} todayISO={dateISO} />

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
                <p className="truncate font-medium text-fg">{a.serviceName ?? 'Serviço'}</p>
                <p className="truncate text-[0.8125rem] text-fg-muted">
                  {dateTimeFmt.format(new Date(a.startAt))} · {a.customerName ?? 'cliente'}
                  {a.professionalName ? ` · ${a.professionalName}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ConfirmAppointmentInline appointmentId={a.id} />
                <Link
                  href={`/admin/dashboard/agenda/${a.id}`}
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
          <span className="text-[0.75rem] font-medium uppercase tracking-[0.14em]">{label}</span>
        </div>
        <p className="font-display text-[1.5rem] font-semibold leading-tight tracking-tight text-fg">
          {value}
        </p>
        <p className="text-[0.75rem] text-fg-muted">{hint}</p>
      </CardContent>
    </Card>
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
        <Link href="/admin/dashboard/agenda" className="text-[0.75rem] text-fg-muted hover:text-fg">
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
