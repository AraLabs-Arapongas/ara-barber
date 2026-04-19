'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertStaff } from '@/lib/auth/guards'
import { professionalSchema } from '@/lib/validation/schemas'

export type ActionState = { error?: string; success?: boolean }

const INITIAL: ActionState = {}

function parseForm(formData: FormData) {
  return professionalSchema.safeParse({
    name: formData.get('name'),
    displayName: formData.get('displayName') || null,
    photoUrl: formData.get('photoUrl') || null,
    phone: formData.get('phone') || null,
    email: formData.get('email') || null,
    commissionType: formData.get('commissionType') ?? 'PERCENTAGE',
    commissionValue: Number(formData.get('commissionValue') ?? 0),
    isActive: formData.get('isActive') !== 'false',
  })
}

export async function createProfessionalAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await assertStaff()
  const parsed = parseForm(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('professionals').insert({
    tenant_id: user.profile.tenantId!,
    name: parsed.data.name,
    display_name: parsed.data.displayName,
    photo_url: parsed.data.photoUrl,
    phone: parsed.data.phone,
    email: parsed.data.email,
    commission_type: parsed.data.commissionType,
    commission_value: parsed.data.commissionValue,
    is_active: parsed.data.isActive,
  })

  if (error) return { error: error.message }

  revalidatePath('/salon/dashboard/profissionais')
  return { success: true }
}

export async function toggleProfessionalActiveAction(id: string, nextActive: boolean) {
  const user = await assertStaff()
  const supabase = await createClient()
  await supabase
    .from('professionals')
    .update({ is_active: nextActive })
    .eq('id', id)
    .eq('tenant_id', user.profile.tenantId!)
  revalidatePath('/salon/dashboard/profissionais')
}

export { INITIAL as INITIAL_PROFESSIONAL_STATE }
