import 'server-only'

import { createSecretClient } from '@/lib/supabase/secret'

export type BookingService = {
  id: string
  name: string
  description: string | null
  durationMinutes: number
  priceCents: number
}

export type BookingProfessional = {
  id: string
  name: string
  displayName: string | null
  phone: string | null
}

export type BusinessHour = {
  weekday: number
  isOpen: boolean
  startTime: string
  endTime: string
}

export type ProfessionalAvailabilityEntry = {
  professionalId: string
  weekday: number
  startTime: string
  endTime: string
}

export type AvailabilityBlock = {
  /** NULL = bloqueio vale pra todos os profissionais do tenant. */
  professionalId: string | null
  startAt: string
  endAt: string
}

/**
 * Tabelas de catálogo não têm policy anon. Usamos service role aqui —
 * o risco é nulo porque o tenant_id vem do proxy (header), não do cliente.
 */

export async function getActiveServicesForTenant(tenantId: string): Promise<BookingService[]> {
  const supabase = createSecretClient()
  const { data } = await supabase
    .from('services')
    .select('id, name, description, duration_minutes, price_cents')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  return (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    durationMinutes: s.duration_minutes,
    priceCents: s.price_cents,
  }))
}

export async function getProfessionalsForService(
  tenantId: string,
  serviceId: string,
): Promise<BookingProfessional[]> {
  const supabase = createSecretClient()
  const { data } = await supabase
    .from('professional_services')
    .select('professional:professionals!inner(id, name, display_name, phone, is_active, tenant_id)')
    .eq('tenant_id', tenantId)
    .eq('service_id', serviceId)

  const rows = (data ?? []) as unknown as Array<{
    professional: {
      id: string
      name: string
      display_name: string | null
      phone: string | null
      is_active: boolean
      tenant_id: string
    } | null
  }>

  const pros: BookingProfessional[] = []
  for (const row of rows) {
    const p = row.professional
    if (!p || !p.is_active || p.tenant_id !== tenantId) continue
    pros.push({
      id: p.id,
      name: p.name,
      displayName: p.display_name,
      phone: p.phone,
    })
  }
  pros.sort((a, b) => (a.displayName ?? a.name).localeCompare(b.displayName ?? b.name))
  return pros
}

export async function getBusinessHours(tenantId: string): Promise<BusinessHour[]> {
  const supabase = createSecretClient()
  const { data } = await supabase
    .from('business_hours')
    .select('weekday, is_open, start_time, end_time')
    .eq('tenant_id', tenantId)

  return (data ?? []).map((h) => ({
    weekday: h.weekday,
    isOpen: h.is_open,
    startTime: h.start_time,
    endTime: h.end_time,
  }))
}

export async function getProfessionalAvailability(
  tenantId: string,
  professionalIds: string[],
): Promise<ProfessionalAvailabilityEntry[]> {
  if (professionalIds.length === 0) return []
  const supabase = createSecretClient()
  const { data } = await supabase
    .from('professional_availability')
    .select('professional_id, weekday, start_time, end_time')
    .eq('tenant_id', tenantId)
    .in('professional_id', professionalIds)

  return (data ?? []).map((a) => ({
    professionalId: a.professional_id,
    weekday: a.weekday,
    startTime: a.start_time,
    endTime: a.end_time,
  }))
}

export async function getAvailabilityBlocksInRange(
  tenantId: string,
  professionalIds: string[],
  startUTC: string,
  endUTC: string,
): Promise<AvailabilityBlock[]> {
  if (professionalIds.length === 0) return []
  const supabase = createSecretClient()
  const { data } = await supabase
    .from('availability_blocks')
    .select('professional_id, start_at, end_at')
    .eq('tenant_id', tenantId)
    .in('professional_id', professionalIds)
    .lt('start_at', endUTC)
    .gt('end_at', startUTC)

  return (data ?? []).map((b) => ({
    professionalId: b.professional_id,
    startAt: b.start_at,
    endAt: b.end_at,
  }))
}

export async function getAppointmentsInRange(
  tenantId: string,
  professionalIds: string[],
  startUTC: string,
  endUTC: string,
): Promise<Array<{ professionalId: string; startAt: string; endAt: string }>> {
  if (professionalIds.length === 0) return []
  const supabase = createSecretClient()
  const { data } = await supabase
    .from('appointments')
    .select('professional_id, start_at, end_at, status')
    .eq('tenant_id', tenantId)
    .in('professional_id', professionalIds)
    .not('status', 'in', '(CANCELED,NO_SHOW)')
    .lt('start_at', endUTC)
    .gt('end_at', startUTC)

  return (data ?? []).map((a) => ({
    professionalId: a.professional_id,
    startAt: a.start_at,
    endAt: a.end_at,
  }))
}

export async function getServiceById(
  tenantId: string,
  serviceId: string,
): Promise<BookingService | null> {
  const supabase = createSecretClient()
  const { data } = await supabase
    .from('services')
    .select('id, name, description, duration_minutes, price_cents, is_active')
    .eq('tenant_id', tenantId)
    .eq('id', serviceId)
    .maybeSingle()

  if (!data || !data.is_active) return null
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    durationMinutes: data.duration_minutes,
    priceCents: data.price_cents,
  }
}

export async function getProfessionalById(
  tenantId: string,
  professionalId: string,
): Promise<BookingProfessional | null> {
  const supabase = createSecretClient()
  const { data } = await supabase
    .from('professionals')
    .select('id, name, display_name, phone, is_active')
    .eq('tenant_id', tenantId)
    .eq('id', professionalId)
    .maybeSingle()

  if (!data || !data.is_active) return null
  return {
    id: data.id,
    name: data.name,
    displayName: data.display_name,
    phone: data.phone,
  }
}
