import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createClient } from '@/lib/supabase/server'
import { ReportsSummary, type ReportAppt } from '@/components/dashboard/reports-summary'
import { TodayOverview } from '@/components/dashboard/today-overview'
import { rangeFromPreset, type RangePreset } from '@/lib/reports/range'
import { getAgendaForDay } from '@/lib/appointments/queries'
import { dateTimeInTenantTZ } from '@/lib/booking/slots'
import type { WeekDay } from '@/components/home/week-agenda-strip'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function parsePreset(raw: string | string[] | undefined): RangePreset {
  if (raw === 'today' || raw === 'week' || raw === 'month') return raw
  return 'month'
}

function todayISO(tenantTimezone: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tenantTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(new Date())
}

export default async function RelatoriosPage({ searchParams }: PageProps) {
  const tenant = await getCurrentTenantOrNotFound()
  const sp = await searchParams
  const preset = parsePreset(sp.preset)
  const range = rangeFromPreset(preset, tenant.timezone)

  const dateISO = todayISO(tenant.timezone)
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

  const supabase = await createClient()
  const [apptsRes, servicesRes, profsRes, today, svcPriceRes, weekApptsRes] = await Promise.all([
    supabase
      .from('appointments')
      .select('status, service_id, professional_id, service_name_snapshot')
      .eq('tenant_id', tenant.id)
      .gte('start_at', range.from)
      .lte('start_at', range.to),
    supabase.from('services').select('id, name').eq('tenant_id', tenant.id),
    supabase.from('professionals').select('id, name, display_name').eq('tenant_id', tenant.id),
    getAgendaForDay(tenant.id, dateISO, tenant.timezone),
    supabase.from('services').select('id, price_cents').eq('tenant_id', tenant.id),
    supabase
      .from('appointments')
      .select('start_at, service_id, price_cents_snapshot')
      .eq('tenant_id', tenant.id)
      .not('status', 'in', '(CANCELED,NO_SHOW)')
      .gte('start_at', weekStartUTC)
      .lte('start_at', weekEndUTC),
  ])

  const priceById = new Map((svcPriceRes.data ?? []).map((s) => [s.id, s.price_cents]))
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

  const activeToday = today.filter((a) => a.status !== 'CANCELED' && a.status !== 'NO_SHOW')
  const completed = today.filter((a) => a.status === 'COMPLETED').length
  const canceled = today.filter((a) => a.status === 'CANCELED' || a.status === 'NO_SHOW').length
  const pendingActive = activeToday.filter(
    (a) => a.status === 'SCHEDULED' || a.status === 'CONFIRMED',
  )
  const todayRevenueCents = activeToday.reduce(
    (sum, a) => sum + (a.priceCentsSnapshot ?? priceById.get(a.serviceId) ?? 0),
    0,
  )
  const completedRevenueCents = activeToday
    .filter((a) => a.status === 'COMPLETED')
    .reduce((sum, a) => sum + (a.priceCentsSnapshot ?? priceById.get(a.serviceId) ?? 0), 0)

  const appointments: ReportAppt[] = (apptsRes.data ?? []).map((a) => ({
    status: a.status,
    service_id: a.service_id,
    professional_id: a.professional_id,
    service_name_snapshot: a.service_name_snapshot,
  }))

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Análises
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Relatórios
        </h1>
      </header>

      <TodayOverview
        todayCount={activeToday.length}
        completed={completed}
        canceled={canceled}
        pendingActiveCount={pendingActive.length}
        todayRevenueCents={todayRevenueCents}
        completedRevenueCents={completedRevenueCents}
        weekDays={weekDays}
        todayISO={dateISO}
      />

      <ReportsSummary
        appointments={appointments}
        services={servicesRes.data ?? []}
        professionals={profsRes.data ?? []}
        currentPreset={preset}
      />
    </main>
  )
}
