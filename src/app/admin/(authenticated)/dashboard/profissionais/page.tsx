import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createClient } from '@/lib/supabase/server'
import { getAgendaForDay } from '@/lib/appointments/queries'
import {
  ProfessionalsManager,
  type ProfessionalListItem,
} from '@/components/dashboard/professionals-manager'
import { hasNoSchedule, worksToday } from '@/lib/admin/derivations'
import { weekdayInTenantTZ } from '@/lib/booking/slots'

function todayISO(tenantTimezone: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tenantTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(new Date())
}

export default async function ProfessionalsPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const supabase = await createClient()

  const dateISO = todayISO(tenant.timezone)
  const weekday = weekdayInTenantTZ(dateISO, tenant.timezone)

  const [profsRes, availRes, svcRes, profServicesRes, todayAppts] = await Promise.all([
    supabase
      .from('professionals')
      .select('id, name, display_name, phone, is_active, user_id')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('professional_availability')
      .select('professional_id, weekday, start_time, end_time')
      .eq('tenant_id', tenant.id),
    supabase.from('services').select('id, price_cents').eq('tenant_id', tenant.id),
    supabase
      .from('professional_services')
      .select('professional_id, service_id')
      .eq('tenant_id', tenant.id),
    getAgendaForDay(tenant.id, dateISO, tenant.timezone),
  ])

  const priceById = new Map((svcRes.data ?? []).map((s) => [s.id, s.price_cents]))

  const availability = (availRes.data ?? []).map((a) => ({
    professionalId: a.professional_id,
    weekday: a.weekday,
    startTime: a.start_time,
    endTime: a.end_time,
  }))

  const profServicesByPro = new Map<string, number>()
  for (const ps of profServicesRes.data ?? []) {
    profServicesByPro.set(
      ps.professional_id,
      (profServicesByPro.get(ps.professional_id) ?? 0) + 1,
    )
  }

  const professionals: ProfessionalListItem[] = (profsRes.data ?? []).map((p) => {
    const apptsForPro = todayAppts.filter(
      (a) =>
        a.professionalId === p.id &&
        a.status !== 'CANCELED' &&
        a.status !== 'NO_SHOW',
    )
    return {
      id: p.id,
      name: p.name,
      displayName: p.display_name,
      phone: p.phone,
      isActive: p.is_active,
      worksToday: worksToday(availability, p.id, weekday),
      hasNoSchedule: hasNoSchedule(availability, p.id),
      appointmentsToday: apptsForPro.length,
      revenueTodayCents: apptsForPro.reduce(
        (sum, a) => sum + (a.priceCentsSnapshot ?? priceById.get(a.serviceId) ?? 0),
        0,
      ),
      servicesCount: profServicesByPro.get(p.id) ?? 0,
      hasUserAccess: p.user_id !== null,
    }
  })

  return <ProfessionalsManager professionals={professionals} />
}
