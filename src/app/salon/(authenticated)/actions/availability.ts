'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertStaff, AuthError } from '@/lib/auth/guards'

const TIME = /^\d{2}:\d{2}(:\d{2})?$/

const Entry = z.object({
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(TIME),
  endTime: z.string().regex(TIME),
})

const SaveWeeklyInput = z.object({
  professionalId: z.string().uuid(),
  entries: z.array(Entry),
})

export type AvailabilityResult = { ok: true } | { ok: false; error: string }

/**
 * Sobrescreve a jornada semanal (professional_availability) de um profissional.
 * Deleta existentes e reinsere — simples e correto.
 */
export async function saveWeeklyAvailability(
  raw: z.infer<typeof SaveWeeklyInput>,
): Promise<AvailabilityResult> {
  const parsed = SaveWeeklyInput.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Dados inválidos.' }

  let user
  try {
    user = await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
  }

  for (const e of parsed.data.entries) {
    if (e.startTime >= e.endTime) {
      return { ok: false, error: 'Início deve ser antes do fim em cada janela.' }
    }
  }

  const supabase = await createClient()
  const tenantId = user.profile.tenantId

  // Valida ownership do profissional
  const { data: prof } = await supabase
    .from('professionals')
    .select('id, tenant_id')
    .eq('id', parsed.data.professionalId)
    .maybeSingle()
  if (!prof || prof.tenant_id !== tenantId) {
    return { ok: false, error: 'Profissional não encontrado.' }
  }

  const { error: delErr } = await supabase
    .from('professional_availability')
    .delete()
    .eq('professional_id', parsed.data.professionalId)
  if (delErr) return { ok: false, error: 'Falha ao limpar jornada anterior.' }

  if (parsed.data.entries.length > 0) {
    const rows = parsed.data.entries.map((e) => ({
      tenant_id: tenantId,
      professional_id: parsed.data.professionalId,
      weekday: e.weekday,
      start_time: e.startTime,
      end_time: e.endTime,
    }))
    const { error: insErr } = await supabase.from('professional_availability').insert(rows)
    if (insErr) return { ok: false, error: 'Falha ao salvar jornada.' }
  }

  revalidatePath('/salon/dashboard/disponibilidade')
  return { ok: true }
}

const CreateBlockInput = z.object({
  professionalId: z.string().uuid(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  reason: z.string().max(200).optional(),
})

export async function createAvailabilityBlock(
  raw: z.infer<typeof CreateBlockInput>,
): Promise<AvailabilityResult> {
  const parsed = CreateBlockInput.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Dados inválidos.' }

  if (new Date(parsed.data.startAt) >= new Date(parsed.data.endAt)) {
    return { ok: false, error: 'Início deve ser antes do fim.' }
  }

  let user
  try {
    user = await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
  }

  const supabase = await createClient()
  const { error } = await supabase.from('availability_blocks').insert({
    tenant_id: user.profile.tenantId,
    professional_id: parsed.data.professionalId,
    start_at: parsed.data.startAt,
    end_at: parsed.data.endAt,
    reason: parsed.data.reason?.trim() || null,
  })

  if (error) return { ok: false, error: 'Falha ao criar bloqueio.' }

  revalidatePath('/salon/dashboard/disponibilidade')
  return { ok: true }
}

const DeleteBlockInput = z.object({ id: z.string().uuid() })

export async function deleteAvailabilityBlock(
  raw: z.infer<typeof DeleteBlockInput>,
): Promise<AvailabilityResult> {
  const parsed = DeleteBlockInput.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Dados inválidos.' }

  try {
    await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('availability_blocks')
    .delete()
    .eq('id', parsed.data.id)

  if (error) return { ok: false, error: 'Falha ao remover.' }

  revalidatePath('/salon/dashboard/disponibilidade')
  return { ok: true }
}
