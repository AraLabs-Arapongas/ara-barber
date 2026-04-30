'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { recordAudit } from '@/lib/audit/log'
import { assertPlatformAdmin } from '@/lib/auth/guards'
import { provisionTenant, ProvisionTenantInputSchema } from '@/lib/platform/provision'
import { createSecretClient } from '@/lib/supabase/secret'

export type CreateTenantState = { error?: string }

export async function createTenantAction(
  _prev: CreateTenantState,
  formData: FormData,
): Promise<CreateTenantState> {
  const user = await assertPlatformAdmin()

  const parsed = ProvisionTenantInputSchema.safeParse({
    slug: formData.get('slug'),
    name: formData.get('name'),
    ownerEmail: formData.get('ownerEmail'),
    ownerName: formData.get('ownerName'),
  })
  if (!parsed.success) {
    return {
      error: parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; '),
    }
  }

  let tenantId: string
  try {
    const result = await provisionTenant(parsed.data)
    tenantId = result.tenantId
    await recordAudit({
      tenantId: result.tenantId,
      actorUserId: user.id,
      actorRole: 'PLATFORM_ADMIN',
      action: 'tenant.create',
      entityType: 'tenant',
      entityId: result.tenantId,
      changes: { slug: parsed.data.slug, ownerEmail: parsed.data.ownerEmail },
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }

  revalidatePath('/tenants')
  redirect(`/tenants/${tenantId}`)
}

const UpdateBrandingSchema = z.object({
  tenantId: z.string().uuid(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
})

export type UpdateBrandingState = { error?: string; ok?: boolean }

export async function updateTenantBrandingAction(
  _prev: UpdateBrandingState,
  formData: FormData,
): Promise<UpdateBrandingState> {
  const user = await assertPlatformAdmin()
  const parsed = UpdateBrandingSchema.safeParse({
    tenantId: formData.get('tenantId'),
    primaryColor: formData.get('primaryColor') || null,
    secondaryColor: formData.get('secondaryColor') || null,
    accentColor: formData.get('accentColor') || null,
  })
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join('; ') }
  const supabase = createSecretClient()
  const { error } = await supabase
    .from('tenants')
    .update({
      primary_color: parsed.data.primaryColor,
      secondary_color: parsed.data.secondaryColor,
      accent_color: parsed.data.accentColor,
    })
    .eq('id', parsed.data.tenantId)
  if (error) return { error: error.message }
  await recordAudit({
    tenantId: parsed.data.tenantId,
    actorUserId: user.id,
    actorRole: 'PLATFORM_ADMIN',
    action: 'tenant.branding.update',
    entityType: 'tenant',
    entityId: parsed.data.tenantId,
    changes: parsed.data,
  })
  revalidatePath(`/tenants/${parsed.data.tenantId}`)
  return { ok: true }
}

const UpsertPlanSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(80),
  monthly_price_cents: z.coerce.number().int().nonnegative(),
  trial_days_default: z.coerce.number().int().nonnegative().default(0),
})

export type UpsertPlanState = { error?: string; ok?: boolean }

export async function upsertPlanAction(
  _prev: UpsertPlanState,
  formData: FormData,
): Promise<UpsertPlanState> {
  const user = await assertPlatformAdmin()
  const parsed = UpsertPlanSchema.safeParse({
    id: formData.get('id') || undefined,
    code: formData.get('code'),
    name: formData.get('name'),
    monthly_price_cents: formData.get('monthly_price_cents'),
    trial_days_default: formData.get('trial_days_default'),
  })
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join('; ') }
  const supabase = createSecretClient()
  const { error } = await supabase.from('plans').upsert(parsed.data)
  if (error) return { error: error.message }
  await recordAudit({
    tenantId: null,
    actorUserId: user.id,
    actorRole: 'PLATFORM_ADMIN',
    action: parsed.data.id ? 'plan.update' : 'plan.create',
    entityType: 'plan',
    entityId: parsed.data.id ?? null,
    changes: parsed.data,
  })
  revalidatePath('/plans')
  return { ok: true }
}

const SetStatusSchema = z.object({
  tenantId: z.string().uuid(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED']),
})

export type SetStatusState = { error?: string; ok?: boolean }

export async function setTenantStatusAction(
  _prev: SetStatusState,
  formData: FormData,
): Promise<SetStatusState> {
  const user = await assertPlatformAdmin()
  const parsed = SetStatusSchema.safeParse({
    tenantId: formData.get('tenantId'),
    status: formData.get('status'),
  })
  if (!parsed.success) return { error: 'Status inválido' }
  const supabase = createSecretClient()
  const { error } = await supabase
    .from('tenants')
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.tenantId)
  if (error) return { error: error.message }
  await recordAudit({
    tenantId: parsed.data.tenantId,
    actorUserId: user.id,
    actorRole: 'PLATFORM_ADMIN',
    action: `tenant.status.${parsed.data.status.toLowerCase()}`,
    entityType: 'tenant',
    entityId: parsed.data.tenantId,
    changes: { status: parsed.data.status },
  })
  revalidatePath(`/tenants/${parsed.data.tenantId}`)
  return { ok: true }
}
