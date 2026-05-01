'use server'

import { revalidateTag } from 'next/cache'
import { assertStaff } from '@/lib/auth/guards'
import { cacheTags } from '@/lib/cache/tags'

/**
 * Server actions de invalidação de cache.
 *
 * Chamadas:
 *   1. Por server actions de mutação pra invalidar imediatamente após escrita.
 *   2. Pelo client realtime hook (RealtimeAppointmentsRefresh) ao receber
 *      postgres_changes — invalida tag ANTES do router.refresh().
 *
 * Toda action exige assertStaff(). Profile 'max' = invalidação imediata
 * (Next 16 exige profile como 2º arg em revalidateTag).
 */

const MAX = 'max'

export async function invalidateAgendaForDay(tenantId: string, dateISO: string) {
  await assertStaff({ expectedTenantId: tenantId })
  revalidateTag(cacheTags.agendaDay(tenantId, dateISO), MAX)
  revalidateTag(cacheTags.agendaPending(tenantId), MAX)
}

export async function invalidateAgendaForDays(tenantId: string, dates: string[]) {
  await assertStaff({ expectedTenantId: tenantId })
  for (const d of dates) revalidateTag(cacheTags.agendaDay(tenantId, d), MAX)
  revalidateTag(cacheTags.agendaPending(tenantId), MAX)
}

export async function invalidateAgendaWeek(tenantId: string, weekStartISO: string) {
  await assertStaff({ expectedTenantId: tenantId })
  revalidateTag(cacheTags.agendaWeek(tenantId, weekStartISO), MAX)
}

export async function invalidateProfessionals(tenantId: string) {
  await assertStaff({ expectedTenantId: tenantId })
  revalidateTag(cacheTags.professionals(tenantId), MAX)
}

export async function invalidateProfessional(tenantId: string, profId: string) {
  await assertStaff({ expectedTenantId: tenantId })
  revalidateTag(cacheTags.professional(tenantId, profId), MAX)
  revalidateTag(cacheTags.professionals(tenantId), MAX)
}

export async function invalidateServices(tenantId: string) {
  await assertStaff({ expectedTenantId: tenantId })
  revalidateTag(cacheTags.services(tenantId), MAX)
}

export async function invalidateService(tenantId: string, serviceId: string) {
  await assertStaff({ expectedTenantId: tenantId })
  revalidateTag(cacheTags.service(tenantId, serviceId), MAX)
  revalidateTag(cacheTags.services(tenantId), MAX)
}
