import Link from 'next/link'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { getTenantBookingUrl } from '@/lib/tenant/public-url'
import { getAgendaForDay } from '@/lib/appointments/queries'
import { STATUS_LABELS, STATUS_TONE } from '@/lib/appointments/labels'
import { Card, CardContent } from '@/components/ui/card'
import { RealtimeAgendaRefresh } from '@/components/agenda/realtime-refresh'
import { StaffPushBanner } from '@/components/push/staff-push-banner'
import { AgendaFilters } from '@/components/agenda/agenda-filters'
import { DaySummary } from '@/components/agenda/day-summary'
import { AgendaEmptyState } from '@/components/agenda/empty-state'
import { AgendaHeaderActions } from '@/components/agenda/agenda-header-actions'
import { WeekAgendaStrip, type WeekDay } from '@/components/home/week-agenda-strip'
import { MoneyVisibilityToggle } from '@/components/ui/money-visibility-toggle'
import { dateTimeInTenantTZ } from '@/lib/booking/slots'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

type AppointmentStatus = Database['public']['Enums']['appointment_status']

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const VALID_STATUSES: AppointmentStatus[] = [
  'SCHEDULED',
  'CONFIRMED',
  'COMPLETED',
  'CANCELED',
  'NO_SHOW',
]

function todayISO(tenantTimezone: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tenantTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(new Date())
}

function validISOOrToday(raw: string | undefined, tenantTimezone: string): string {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  return todayISO(tenantTimezone)
}

function timeLabel(iso: string, tenantTimezone: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: tenantTimezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function sundayOfWeekISO(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return addDaysISO(dateISO, -date.getUTCDay())
}

function formatDayHeader(dateISO: string, todayISOStr: string, tenantTimezone: string): string {
  const tomorrow = addDaysISO(todayISOStr, 1)
  const yesterday = addDaysISO(todayISOStr, -1)
  if (dateISO === todayISOStr) return 'Hoje'
  if (dateISO === tomorrow) return 'Amanhã'
  if (dateISO === yesterday) return 'Ontem'
  const [y, m, d] = dateISO.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: tenantTimezone,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(new Date(Date.UTC(y, m - 1, d, 12)))
}

function formatWeekRange(weekStartISO: string, weekEndISO: string): string {
  const sd = Number(weekStartISO.slice(8, 10))
  const ed = Number(weekEndISO.slice(8, 10))
  const monthFmt = new Intl.DateTimeFormat('pt-BR', { month: 'short' })
  const startMonth = monthFmt.format(new Date(`${weekStartISO}T12:00:00Z`)).replace('.', '')
  const endMonth = monthFmt.format(new Date(`${weekEndISO}T12:00:00Z`)).replace('.', '')
  if (weekStartISO.slice(0, 7) === weekEndISO.slice(0, 7)) {
    return `${sd}–${ed} ${endMonth}`
  }
  return `${sd} ${startMonth} – ${ed} ${endMonth}`
}

export default async function AgendaPage({ searchParams }: PageProps) {
  const tenant = await getCurrentTenantOrNotFound()
  const sp = await searchParams
  const rawDate = typeof sp.date === 'string' ? sp.date : undefined
  const dateISO = validISOOrToday(rawDate, tenant.timezone)
  const todayISOStr = todayISO(tenant.timezone)
  const profFilter = typeof sp.professional === 'string' ? sp.professional : null
  const statusRaw = typeof sp.status === 'string' ? sp.status : null
  const statusFilter =
    statusRaw && (VALID_STATUSES as string[]).includes(statusRaw)
      ? (statusRaw as AppointmentStatus)
      : null

  // Semana do dia selecionado (Dom→Sáb)
  const weekStartISO = sundayOfWeekISO(dateISO)
  const weekDateISOs = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStartISO, i))
  const weekStartUTC = dateTimeInTenantTZ(weekStartISO, '00:00', tenant.timezone).toISOString()
  const weekEndUTC = dateTimeInTenantTZ(weekDateISOs[6], '23:59', tenant.timezone).toISOString()

  const supabase = await createClient()
  const [appointments, profsRes, svcRes, weekApptsRes] = await Promise.all([
    getAgendaForDay(tenant.id, dateISO, tenant.timezone),
    supabase
      .from('professionals')
      .select('id, name')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('name'),
    supabase.from('services').select('id, price_cents').eq('tenant_id', tenant.id),
    supabase
      .from('appointments')
      .select('start_at, service_id, price_cents_snapshot')
      .eq('tenant_id', tenant.id)
      .not('status', 'in', '(CANCELED,NO_SHOW)')
      .gte('start_at', weekStartUTC)
      .lte('start_at', weekEndUTC),
  ])
  const priceById = new Map((svcRes.data ?? []).map((s) => [s.id, s.price_cents]))
  const professionals = (profsRes.data ?? []).map((p) => ({ id: p.id, name: p.name }))

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

  const filtered = appointments.filter((a) => {
    if (profFilter && a.professionalId !== profFilter) return false
    if (statusFilter && a.status !== statusFilter) return false
    return true
  })

  const publicUrl = await getTenantBookingUrl(tenant)
  const hasAnyToday = appointments.length > 0
  const isFiltering = Boolean(profFilter || statusFilter)

  // Path II: navegação entre semanas via prev/next; "Hoje" volta pra dateISO atual.
  const todaysWeekStart = sundayOfWeekISO(todayISOStr)
  const isCurrentWeek = weekStartISO === todaysWeekStart
  const prevWeekDateISO = addDaysISO(weekStartISO, -7)
  const nextWeekDateISO = addDaysISO(weekStartISO, 7)
  const buildAgendaHref = (d: string) => {
    const params = new URLSearchParams()
    params.set('date', d)
    if (profFilter) params.set('professional', profFilter)
    if (statusRaw && (VALID_STATUSES as string[]).includes(statusRaw))
      params.set('status', statusRaw)
    return `/admin/dashboard/agenda?${params.toString()}`
  }

  const dayHeader = formatDayHeader(dateISO, todayISOStr, tenant.timezone)

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
            Operação
          </p>
          <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
            Agenda
          </h1>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <AgendaHeaderActions publicUrl={publicUrl} />
          <MoneyVisibilityToggle />
        </div>
      </header>

      <StaffPushBanner />

      <WeekAgendaStrip
        days={weekDays}
        todayISO={todayISOStr}
        selectedDateISO={dateISO}
        onDayClickHref={buildAgendaHref}
        weekNav={{
          rangeLabel: formatWeekRange(weekStartISO, weekDateISOs[6]),
          prevHref: buildAgendaHref(prevWeekDateISO),
          nextHref: buildAgendaHref(nextWeekDateISO),
          todayHref: buildAgendaHref(todayISOStr),
          isCurrentWeek,
        }}
      />

      <p className="mb-3 mt-1 text-center text-[0.8125rem] text-fg-muted">{dayHeader}</p>

      <RealtimeAgendaRefresh tenantId={tenant.id} />

      <AgendaFilters professionals={professionals} />
      <DaySummary appointments={filtered} priceById={priceById} />

      {filtered.length > 0 ? (
        <ul className="space-y-2">
          {filtered.map((a) => {
            const durationMin = Math.round(
              (new Date(a.endAt).getTime() - new Date(a.startAt).getTime()) / 60000,
            )
            const isCanceled = a.status === 'CANCELED' || a.status === 'NO_SHOW'
            return (
              <li key={a.id}>
                <Link href={`/admin/dashboard/agenda/${a.id}${rawDate ? `?from=${rawDate}` : ''}`}>
                  <Card
                    className={`shadow-xs transition-colors hover:bg-bg-subtle ${
                      isCanceled ? 'opacity-60' : ''
                    }`}
                  >
                    <CardContent className="flex items-center gap-3 py-3">
                      <span className="flex h-14 w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-bg-subtle">
                        <span
                          className={`font-display text-[0.9375rem] font-semibold text-fg ${
                            isCanceled ? 'line-through decoration-fg-subtle' : ''
                          }`}
                        >
                          {timeLabel(a.startAt, tenant.timezone)}
                        </span>
                        <span className="text-[0.6875rem] text-fg-muted">{durationMin}min</span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate font-medium text-fg ${
                            isCanceled ? 'line-through decoration-fg-subtle' : ''
                          }`}
                        >
                          {a.serviceName ?? 'Serviço'}
                        </p>
                        <p className="truncate text-[0.8125rem] text-fg-muted">
                          {a.customerName ?? 'Cliente'} · {a.professionalName ?? '—'}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide ${STATUS_TONE[a.status]}`}
                      >
                        {STATUS_LABELS[a.status]}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : hasAnyToday && isFiltering ? (
        <Card className="shadow-xs">
          <CardContent className="py-10 text-center">
            <p className="text-[0.9375rem] text-fg-muted">
              Nenhum agendamento para os filtros selecionados.
            </p>
            <p className="mt-1 text-[0.8125rem] text-fg-subtle">
              Ajuste os filtros acima pra ver mais.
            </p>
          </CardContent>
        </Card>
      ) : (
        <AgendaEmptyState />
      )}
    </main>
  )
}
