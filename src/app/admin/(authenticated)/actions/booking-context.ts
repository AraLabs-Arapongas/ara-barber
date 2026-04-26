'use server'

import { z } from 'zod'

import { assertStaff, AuthError } from '@/lib/auth/guards'
import { dateTimeInTenantTZ } from '@/lib/booking/slots'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import type {
  AvailabilityBlock,
  BookingProfessional,
  BookingService,
  BusinessHour,
  ProfessionalAvailabilityEntry,
} from '@/lib/booking/queries'

const Input = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data YYYY-MM-DD'),
})

export type BookingContextInput = z.infer<typeof Input>

export type BookingContext = {
  tenantId: string
  tenantTimezone: string
  services: BookingService[]
  professionals: BookingProfessional[]
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

export async function getBookingContext(
  raw: BookingContextInput,
): Promise<{ ok: true; context: BookingContext } | { ok: false; error: string }> {
  const parsed = Input.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Input inválido' }
  }

  try {
    await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
  }

  const tenant = await getCurrentTenantOrNotFound()

  const supabase = await createClient()
  const { from, to } = parsed.data
  const fromUTC = dateTimeInTenantTZ(from, '00:00', tenant.timezone).toISOString()
  const toUTC = dateTimeInTenantTZ(to, '23:59', tenant.timezone).toISOString()

  const [services, professionals, profServices, hours, availability, blocks, appts] =
    await Promise.all([
      supabase
        .from('services')
        .select('id, name, description, duration_minutes, price_cents')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('professionals')
        .select('id, name, display_name, phone')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('professional_services')
        .select('professional_id, service_id')
        .eq('tenant_id', tenant.id),
      supabase
        .from('business_hours')
        .select('weekday, is_open, start_time, end_time')
        .eq('tenant_id', tenant.id),
      supabase
        .from('professional_availability')
        .select('professional_id, weekday, start_time, end_time')
        .eq('tenant_id', tenant.id),
      supabase
        .from('availability_blocks')
        .select('professional_id, start_at, end_at')
        .eq('tenant_id', tenant.id)
        .lt('start_at', toUTC)
        .gt('end_at', fromUTC),
      supabase
        .from('appointments')
        .select('professional_id, start_at, end_at')
        .eq('tenant_id', tenant.id)
        .not('status', 'in', '(CANCELED,NO_SHOW)')
        .lt('start_at', toUTC)
        .gt('end_at', fromUTC),
    ])

  return {
    ok: true,
    context: {
      tenantId: tenant.id,
      tenantTimezone: tenant.timezone,
      services: (services.data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        durationMinutes: s.duration_minutes,
        priceCents: s.price_cents,
      })),
      professionals: (professionals.data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        displayName: p.display_name,
        phone: p.phone,
      })),
      professionalServices: (profServices.data ?? []).map((r) => ({
        professionalId: r.professional_id,
        serviceId: r.service_id,
      })),
      businessHours: (hours.data ?? []).map((h) => ({
        weekday: h.weekday,
        isOpen: h.is_open,
        startTime: h.start_time,
        endTime: h.end_time,
      })),
      availability: (availability.data ?? []).map((a) => ({
        professionalId: a.professional_id,
        weekday: a.weekday,
        startTime: a.start_time,
        endTime: a.end_time,
      })),
      blocks: (blocks.data ?? []).map((b) => ({
        professionalId: b.professional_id,
        startAt: b.start_at,
        endAt: b.end_at,
      })),
      existingAppointments: (appts.data ?? []).map((a) => ({
        professionalId: a.professional_id,
        startAt: a.start_at,
        endAt: a.end_at,
      })),
    },
  }
}
