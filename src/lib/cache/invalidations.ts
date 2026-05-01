'use server'

import { updateTag } from 'next/cache'
import { assertStaff } from '@/lib/auth/guards'
import { cacheTags } from '@/lib/cache/tags'

/**
 * Server actions de invalidação de cache.
 *
 * Chamadas:
 *   1. Por server actions de mutação (createAppointment, updateProfessional…)
 *      pra invalidar imediatamente após escrita confirmada no DB.
 *   2. Pelo client realtime hook (RealtimeAppointmentsRefresh) ao receber
 *      postgres_changes — invalida tag relevante ANTES do router.refresh()
 *      pra garantir que o re-fetch venha do DB e não do cache stale.
 *
 * Toda action exige assertStaff() porque expõe um endpoint público que
 * forçaria invalidação arbitrária se não autenticado. Tenant scope é checado
 * via expectedTenantId.
 */

export async function invalidateAgendaForDay(tenantId: string, dateISO: string) {
  await assertStaff({ expectedTenantId: tenantId })
  updateTag(cacheTags.agendaDay(tenantId, dateISO))
  updateTag(cacheTags.agendaPending(tenantId))
}

export async function invalidateAgendaForDays(tenantId: string, dates: string[]) {
  await assertStaff({ expectedTenantId: tenantId })
  for (const d of dates) updateTag(cacheTags.agendaDay(tenantId, d))
  updateTag(cacheTags.agendaPending(tenantId))
}

export async function invalidateAgendaWeek(tenantId: string, weekStartISO: string) {
  await assertStaff({ expectedTenantId: tenantId })
  updateTag(cacheTags.agendaWeek(tenantId, weekStartISO))
}

export async function invalidateProfessionals(tenantId: string) {
  await assertStaff({ expectedTenantId: tenantId })
  updateTag(cacheTags.professionals(tenantId))
}

export async function invalidateProfessional(tenantId: string, profId: string) {
  await assertStaff({ expectedTenantId: tenantId })
  updateTag(cacheTags.professional(tenantId, profId))
  updateTag(cacheTags.professionals(tenantId))
}

export async function invalidateServices(tenantId: string) {
  await assertStaff({ expectedTenantId: tenantId })
  updateTag(cacheTags.services(tenantId))
}

export async function invalidateService(tenantId: string, serviceId: string) {
  await assertStaff({ expectedTenantId: tenantId })
  updateTag(cacheTags.service(tenantId, serviceId))
  updateTag(cacheTags.services(tenantId))
}
