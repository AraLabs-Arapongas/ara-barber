'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertStaff, AuthError } from '@/lib/auth/guards'

const CreateInput = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  durationMinutes: z.number().int().min(5).max(480),
  priceCents: z.number().int().nonnegative(),
})

const ToggleInput = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
})

export type ServiceResult = { ok: true } | { ok: false; error: string }

export async function createService(raw: z.infer<typeof CreateInput>): Promise<ServiceResult> {
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
  const { error } = await supabase.from('services').insert({
    tenant_id: user.profile.tenantId,
    name: parsed.data.name.trim(),
    description: parsed.data.description?.trim() || null,
    duration_minutes: parsed.data.durationMinutes,
    price_cents: parsed.data.priceCents,
    is_active: true,
  })

  if (error) return { ok: false, error: 'Falha ao criar serviço.' }

  revalidatePath('/admin/dashboard/servicos')
  revalidatePath('/admin/dashboard/equipe-servicos')
  return { ok: true }
}

const UpdateInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  durationMinutes: z.number().int().min(5).max(480),
  priceCents: z.number().int().nonnegative(),
})

export async function updateService(raw: z.infer<typeof UpdateInput>): Promise<ServiceResult> {
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
    .from('services')
    .update({
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() || null,
      duration_minutes: parsed.data.durationMinutes,
      price_cents: parsed.data.priceCents,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.id)
    .eq('tenant_id', user.profile.tenantId)

  if (error) return { ok: false, error: 'Falha ao atualizar serviço.' }

  revalidatePath('/admin/dashboard/servicos')
  revalidatePath('/admin/dashboard/equipe-servicos')
  return { ok: true }
}

export async function toggleServiceActive(
  raw: z.infer<typeof ToggleInput>,
): Promise<ServiceResult> {
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
    .from('services')
    .update({ is_active: parsed.data.isActive, updated_at: new Date().toISOString() })
    .eq('id', parsed.data.id)

  if (error) return { ok: false, error: 'Falha ao atualizar.' }

  revalidatePath('/admin/dashboard/servicos')
  return { ok: true }
}
