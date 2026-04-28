import 'server-only'

import { dateTimeInTenantTZ } from '@/lib/booking/slots'
import {
  getActiveServicesForTenant,
  getAppointmentsInRange,
  getAvailabilityBlocksInRange,
  getBusinessHours,
  getProfessionalAvailability,
  type AvailabilityBlock,
  type BookingProfessional,
  type BookingService,
  type BusinessHour,
  type ProfessionalAvailabilityEntry,
} from '@/lib/booking/queries'
import { createSecretClient } from '@/lib/supabase/secret'
import type { TenantContext } from '@/lib/tenant/context'

/**
 * Contexto completo pra o wizard cliente em `/book`. Tudo carregado no
 * server numa só passada — o wizard renderiza single-page client-side e
 * usa `computeSlots()` pra gerar horários a partir desses dados (sem
 * round-trip por step).
 *
 * Janela = `tenant.booking_window_days` (default 14). Não inclui o passado:
 * range é [hoje 00:00, hoje + window 23:59] no fuso do tenant.
 *
 * Acesso: `createSecretClient` (bypass RLS) — seguro porque tenantId vem
 * do proxy (header), nunca do cliente. Mesma estratégia de `queries.ts`.
 */
export type CustomerBookingContext = {
  tenantId: string
  tenantTimezone: string
  bookingWindowDays: number
  minAdvanceHours: number
  slotIntervalMinutes: number
  /** Date YYYY-MM-DD do primeiro dia disponível (hoje no fuso do tenant). */
  rangeStartDate: string
  /** Date YYYY-MM-DD do último dia disponível (hoje + window-1). */
  rangeEndDate: string
  services: BookingService[]
  professionals: BookingProfessional[]
  /** Mapa serviço → profissionais que o atendem. */
  professionalServices: Array<{ professionalId: string; serviceId: string }>
  businessHours: BusinessHour[]
  availability: ProfessionalAvailabilityEntry[]
  blocks: AvailabilityBlock[]
  existingAppointments: Array<{
    professionalId: string
    startAt: string
    endAt: string
  }>
}

/**
 * Carrega contexto cliente completo. Recebe o `TenantContext` já resolvido
 * pelo proxy (via `getCurrentTenantOrNotFound`), evitando dupla query.
 */
export async function getCustomerBookingContext(
  tenant: TenantContext,
): Promise<CustomerBookingContext> {
  const tz = tenant.timezone
  const windowDays = tenant.bookingWindowDays

  // "Hoje" no fuso do tenant — formatado YYYY-MM-DD pra usar com dateTimeInTenantTZ.
  const now = new Date()
  const localToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now) // 'YYYY-MM-DD'

  const lastDay = new Date(`${localToday}T00:00:00Z`)
  lastDay.setUTCDate(lastDay.getUTCDate() + windowDays - 1)
  const localLast = lastDay.toISOString().slice(0, 10)

  const startUTC = dateTimeInTenantTZ(localToday, '00:00', tz).toISOString()
  const endUTC = dateTimeInTenantTZ(localLast, '23:59', tz).toISOString()

  // Carrega services + professionals primeiro pra ter os IDs antes de
  // consultar tabelas que filtram por professional_id.
  const [services, allProfsData] = await Promise.all([
    getActiveServicesForTenant(tenant.id),
    (async () => {
      const supabase = createSecretClient()
      const { data } = await supabase
        .from('professionals')
        .select('id, name, display_name, phone')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('name')
      return data ?? []
    })(),
  ])

  const professionals: BookingProfessional[] = allProfsData.map((p) => ({
    id: p.id,
    name: p.name,
    displayName: p.display_name,
    phone: p.phone,
  }))
  const professionalIds = professionals.map((p) => p.id)

  const [profServicesData, businessHours, availability, blocks, existingAppointments] =
    await Promise.all([
      (async () => {
        const supabase = createSecretClient()
        const { data } = await supabase
          .from('professional_services')
          .select('professional_id, service_id')
          .eq('tenant_id', tenant.id)
        return data ?? []
      })(),
      getBusinessHours(tenant.id),
      getProfessionalAvailability(tenant.id, professionalIds),
      getAvailabilityBlocksInRange(tenant.id, professionalIds, startUTC, endUTC),
      getAppointmentsInRange(tenant.id, professionalIds, startUTC, endUTC),
    ])

  return {
    tenantId: tenant.id,
    tenantTimezone: tz,
    bookingWindowDays: windowDays,
    minAdvanceHours: tenant.minAdvanceHours,
    slotIntervalMinutes: tenant.slotIntervalMinutes,
    rangeStartDate: localToday,
    rangeEndDate: localLast,
    services,
    professionals,
    professionalServices: profServicesData.map((r) => ({
      professionalId: r.professional_id,
      serviceId: r.service_id,
    })),
    businessHours,
    availability,
    blocks,
    existingAppointments,
  }
}
