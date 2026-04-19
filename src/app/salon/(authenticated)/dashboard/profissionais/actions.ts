'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertStaff } from '@/lib/auth/guards'
import { professionalSchema } from '@/lib/validation/schemas'
import { parseBrlToCents, parsePercentToBasisPoints } from '@/lib/money'

export type ActionState = { error?: string; success?: boolean }

const INITIAL: ActionState = {}

function parseCommissionValue(raw: unknown, type: 'PERCENTAGE' | 'FIXED'): number | null {
  if (typeof raw !== 'string') return null
  return type === 'PERCENTAGE' ? parsePercentToBasisPoints(raw) : parseBrlToCents(raw)
}

export async function createProfessionalAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await assertStaff()

  const commissionType = (formData.get('commissionType') ?? 'PERCENTAGE') as
    | 'PERCENTAGE'
    | 'FIXED'
  const commissionValue = parseCommissionValue(formData.get('commissionValue'), commissionType)
  if (commissionValue === null) {
    return {
      error:
        commissionType === 'PERCENTAGE'
          ? 'Informe a porcentagem (ex: 50 para 50%).'
          : 'Informe o valor em reais (ex: 80,00).',
    }
  }

  const parsed = professionalSchema.safeParse({
    name: formData.get('name'),
    displayName: formData.get('displayName') || null,
    photoUrl: formData.get('photoUrl') || null,
    phone: formData.get('phone') || null,
    email: formData.get('email') || null,
    commissionType,
    commissionValue,
    isActive: formData.get('isActive') !== 'false',
  })

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
