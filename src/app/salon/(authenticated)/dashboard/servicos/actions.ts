'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertStaff } from '@/lib/auth/guards'
import { serviceSchema } from '@/lib/validation/schemas'

export type ActionState = { error?: string; success?: boolean }

const INITIAL: ActionState = {}

export async function createServiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await assertStaff()

  const parsed = serviceSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') || null,
    durationMinutes: Number(formData.get('durationMinutes') ?? 30),
    priceCents: Number(formData.get('priceCents') ?? 0),
    depositRequired: false,
    depositType: null,
    depositValueCents: null,
    depositPercentage: null,
    isActive: true,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('services').insert({
    tenant_id: user.profile.tenantId!,
    name: parsed.data.name,
    description: parsed.data.description,
    duration_minutes: parsed.data.durationMinutes,
    price_cents: parsed.data.priceCents,
    deposit_required: false,
    deposit_type: null,
    deposit_value_cents: null,
    deposit_percentage: null,
    is_active: true,
  })

  if (error) return { error: error.message }

  revalidatePath('/salon/dashboard/servicos')
  return { success: true }
}

export { INITIAL as INITIAL_SERVICE_STATE }
