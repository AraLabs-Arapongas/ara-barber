'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertStaff, AuthError } from '@/lib/auth/guards'

const CreateInput = z.object({
  name: z.string().min(1).max(200),
  displayName: z.string().max(100).optional(),
  phone: z.string().max(32).optional(),
})

const ToggleInput = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
})

export type ProfessionalResult = { ok: true } | { ok: false; error: string }

export async function createProfessional(
  raw: z.infer<typeof CreateInput>,
): Promise<ProfessionalResult> {
  const parsed = CreateInput.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Dados inválidos.' }

  let user
  try {
    user = await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
  }

  const supabase = await createClient()
  const { error } = await supabase.from('professionals').insert({
    tenant_id: user.profile.tenantId,
    name: parsed.data.name.trim(),
    display_name: parsed.data.displayName?.trim() || null,
    phone: parsed.data.phone?.trim() || null,
    is_active: true,
  })

  if (error) return { ok: false, error: 'Falha ao criar profissional.' }

  revalidatePath('/salon/dashboard/profissionais')
  revalidatePath('/salon/dashboard/equipe-servicos')
  return { ok: true }
}

const UpdateInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  displayName: z.string().max(100).optional(),
  phone: z.string().max(32).optional(),
})

export async function updateProfessional(
  raw: z.infer<typeof UpdateInput>,
): Promise<ProfessionalResult> {
  const parsed = UpdateInput.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Dados inválidos.' }

  let user
  try {
    user = await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('professionals')
    .update({
      name: parsed.data.name.trim(),
      display_name: parsed.data.displayName?.trim() || null,
      phone: parsed.data.phone?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.id)
    .eq('tenant_id', user.profile.tenantId)

  if (error) return { ok: false, error: 'Falha ao atualizar profissional.' }

  revalidatePath('/salon/dashboard/profissionais')
  revalidatePath('/salon/dashboard/equipe-servicos')
  return { ok: true }
}

export async function toggleProfessionalActive(
  raw: z.infer<typeof ToggleInput>,
): Promise<ProfessionalResult> {
  const parsed = ToggleInput.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Dados inválidos.' }

  try {
    await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('professionals')
    .update({ is_active: parsed.data.isActive, updated_at: new Date().toISOString() })
    .eq('id', parsed.data.id)

  if (error) return { ok: false, error: 'Falha ao atualizar.' }

  revalidatePath('/salon/dashboard/profissionais')
  return { ok: true }
}
