'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { assertStaff } from '@/lib/auth/guards'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createSecretClient } from '@/lib/supabase/secret'
import { recordAudit } from '@/lib/audit/log'

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const BusinessHourDaySchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    is_open: z.boolean(),
    start_time: z.string().regex(TIME_REGEX, 'Formato HH:MM'),
    end_time: z.string().regex(TIME_REGEX, 'Formato HH:MM'),
  })
  .refine(
    (d) => !d.is_open || d.start_time < d.end_time,
    { message: 'start_time deve ser menor que end_time quando aberto' },
  )

export const BusinessHoursStepSchema = z.object({
  days: z.array(BusinessHourDaySchema).length(7, 'Exatamente 7 dias'),
})

export const ServicesStepSchema = z.object({
  services: z
    .array(
      z.object({
        name: z.string().min(1, 'Nome obrigatório').max(120),
        duration_minutes: z.coerce.number().int().positive('Duração > 0'),
        price_cents: z.coerce.number().int().nonnegative('Preço >= 0'),
      }),
    )
    .min(1, 'Cadastre pelo menos 1 serviço'),
})

export const ProfessionalsStepSchema = z.object({
  professionals: z
    .array(
      z.object({
        name: z.string().min(1, 'Nome obrigatório').max(80),
      }),
    )
    .min(1, 'Cadastre pelo menos 1 profissional'),
})

export const LinksStepSchema = z.object({
  links: z
    .array(
      z.object({
        service_id: z.string().regex(UUID_REGEX, 'UUID inválido'),
        professional_id: z.string().regex(UUID_REGEX, 'UUID inválido'),
      }),
    )
    .min(1, 'Marque pelo menos 1 vínculo'),
})

export type StepActionState = { error?: string }

function parseJsonField<T>(formData: FormData): T {
  const raw = formData.get('payload')
  if (typeof raw !== 'string') throw new Error('Campo payload ausente')
  return JSON.parse(raw) as T
}

async function ensureStaff() {
  const tenant = await getCurrentTenantOrNotFound()
  const user = await assertStaff({ expectedTenantId: tenant.id })
  return { tenant, user }
}

export async function saveBusinessHoursStep(
  _prev: StepActionState,
  formData: FormData,
): Promise<StepActionState> {
  const { tenant, user } = await ensureStaff()
  let payload: unknown
  try {
    payload = parseJsonField(formData)
  } catch {
    return { error: 'Payload inválido' }
  }
  const parsed = BusinessHoursStepSchema.safeParse(payload)
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join('; ') }
  }
  const supabase = createSecretClient()
  const { error: delErr } = await supabase
    .from('business_hours')
    .delete()
    .eq('tenant_id', tenant.id)
  if (delErr) return { error: `delete: ${delErr.message}` }
  const { error: insErr } = await supabase.from('business_hours').insert(
    parsed.data.days.map((d) => ({
      tenant_id: tenant.id,
      weekday: d.weekday,
      is_open: d.is_open,
      start_time: `${d.start_time}:00`,
      end_time: `${d.end_time}:00`,
    })),
  )
  if (insErr) return { error: `insert: ${insErr.message}` }
  await supabase
    .from('tenants')
    .update({ onboarding_step: 'services' })
    .eq('id', tenant.id)
  await recordAudit({
    tenantId: tenant.id,
    actorUserId: user.id,
    actorRole: user.profile.role,
    action: 'onboarding.step.hours',
    entityType: 'tenant',
    entityId: tenant.id,
    changes: { days: parsed.data.days.length },
  })
  revalidatePath('/admin/setup')
  redirect('/admin/setup/servicos')
}

export async function saveServicesStep(
  _prev: StepActionState,
  formData: FormData,
): Promise<StepActionState> {
  const { tenant, user } = await ensureStaff()
  let payload: unknown
  try {
    payload = parseJsonField(formData)
  } catch {
    return { error: 'Payload inválido' }
  }
  const parsed = ServicesStepSchema.safeParse(payload)
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join('; ') }
  }
  const supabase = createSecretClient()
  const { error: delErr } = await supabase
    .from('services')
    .delete()
    .eq('tenant_id', tenant.id)
  if (delErr) return { error: `delete: ${delErr.message}` }
  const { error: insErr } = await supabase.from('services').insert(
    parsed.data.services.map((s) => ({
      tenant_id: tenant.id,
      name: s.name,
      duration_minutes: s.duration_minutes,
      price_cents: s.price_cents,
      is_active: true,
    })),
  )
  if (insErr) return { error: `insert: ${insErr.message}` }
  await supabase
    .from('tenants')
    .update({ onboarding_step: 'professionals' })
    .eq('id', tenant.id)
  await recordAudit({
    tenantId: tenant.id,
    actorUserId: user.id,
    actorRole: user.profile.role,
    action: 'onboarding.step.services',
    entityType: 'tenant',
    entityId: tenant.id,
    changes: { count: parsed.data.services.length },
  })
  revalidatePath('/admin/setup')
  redirect('/admin/setup/profissionais')
}

export async function saveProfessionalsStep(
  _prev: StepActionState,
  formData: FormData,
): Promise<StepActionState> {
  const { tenant, user } = await ensureStaff()
  let payload: unknown
  try {
    payload = parseJsonField(formData)
  } catch {
    return { error: 'Payload inválido' }
  }
  const parsed = ProfessionalsStepSchema.safeParse(payload)
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join('; ') }
  }
  const supabase = createSecretClient()
  const { error: delErr } = await supabase
    .from('professionals')
    .delete()
    .eq('tenant_id', tenant.id)
  if (delErr) return { error: `delete: ${delErr.message}` }
  const { error: insErr } = await supabase.from('professionals').insert(
    parsed.data.professionals.map((p) => ({
      tenant_id: tenant.id,
      name: p.name,
      is_active: true,
    })),
  )
  if (insErr) return { error: `insert: ${insErr.message}` }
  await supabase
    .from('tenants')
    .update({ onboarding_step: 'links' })
    .eq('id', tenant.id)
  await recordAudit({
    tenantId: tenant.id,
    actorUserId: user.id,
    actorRole: user.profile.role,
    action: 'onboarding.step.professionals',
    entityType: 'tenant',
    entityId: tenant.id,
    changes: { count: parsed.data.professionals.length },
  })
  revalidatePath('/admin/setup')
  redirect('/admin/setup/vinculos')
}

export async function saveLinksStep(
  _prev: StepActionState,
  formData: FormData,
): Promise<StepActionState> {
  const { tenant, user } = await ensureStaff()
  let payload: unknown
  try {
    payload = parseJsonField(formData)
  } catch {
    return { error: 'Payload inválido' }
  }
  const parsed = LinksStepSchema.safeParse(payload)
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join('; ') }
  }
  const supabase = createSecretClient()
  const { error: delErr } = await supabase
    .from('professional_services')
    .delete()
    .eq('tenant_id', tenant.id)
  if (delErr) return { error: `delete: ${delErr.message}` }
  const { error: insErr } = await supabase.from('professional_services').insert(
    parsed.data.links.map((l) => ({
      tenant_id: tenant.id,
      service_id: l.service_id,
      professional_id: l.professional_id,
    })),
  )
  if (insErr) return { error: `insert: ${insErr.message}` }
  await supabase
    .from('tenants')
    .update({ onboarding_completed_at: new Date().toISOString(), onboarding_step: null })
    .eq('id', tenant.id)
  await recordAudit({
    tenantId: tenant.id,
    actorUserId: user.id,
    actorRole: user.profile.role,
    action: 'onboarding.completed',
    entityType: 'tenant',
    entityId: tenant.id,
    changes: { links: parsed.data.links.length },
  })
  revalidatePath('/admin/setup')
  revalidatePath('/admin/dashboard')
  redirect('/admin/dashboard?welcome=1')
}

export async function dismissWizardAction(): Promise<void> {
  await ensureStaff()
  const c = await cookies()
  c.set('ara_setup_dismissed', '1', {
    path: '/admin',
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
  })
  redirect('/admin/dashboard')
}
