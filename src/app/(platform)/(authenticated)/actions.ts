'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordAudit } from '@/lib/audit/log'
import { assertPlatformAdmin } from '@/lib/auth/guards'
import { provisionTenant, ProvisionTenantInputSchema } from '@/lib/platform/provision'

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
