'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assertStaff, AuthError } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

const CreateInput = z.object({
  scope: z.enum(['TENANT', 'PROFESSIONAL']),
  professionalId: z.string().uuid().optional(),
  startAtISO: z.string().datetime(),
  endAtISO: z.string().datetime(),
  reason: z.string().max(200).optional().or(z.literal('')),
})

export type CreateBlockInput = z.infer<typeof CreateInput>
export type CreateBlockResult = { ok: true; id: string } | { ok: false; error: string }

/**
 * Cria um bloqueio de disponibilidade. `scope = TENANT` salva
 * `professional_id = null` (negócio inteiro). `scope = PROFESSIONAL` exige
 * o id e bloqueia só aquele profissional.
 *
 * RLS: `availability_blocks_tenant_staff_all` permite qualquer staff
 * inserir/deletar — não exigimos BUSINESS_OWNER aqui (plano Phase 5 não pede).
 */
export async function createBlock(raw: CreateBlockInput): Promise<CreateBlockResult> {
  let user
  try {
    user = await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
  }

  const parsed = CreateInput.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }
  const data = parsed.data

  if (data.scope === 'PROFESSIONAL' && !data.professionalId) {
    return { ok: false, error: 'Selecione um profissional.' }
  }
  if (new Date(data.endAtISO) <= new Date(data.startAtISO)) {
    return { ok: false, error: 'Fim deve ser depois do início.' }
  }

  const tenantId = user.profile.tenantId
  if (!tenantId) return { ok: false, error: 'Sem tenant associado.' }

  const supabase = await createClient()
  const { data: created, error } = await supabase
    .from('availability_blocks')
    .insert({
      tenant_id: tenantId,
      professional_id: data.scope === 'TENANT' ? null : data.professionalId!,
      start_at: data.startAtISO,
      end_at: data.endAtISO,
      reason: data.reason ? data.reason.trim() || null : null,
    })
    .select('id')
    .single()

  if (error || !created) {
    return { ok: false, error: error?.message ?? 'Falha ao criar bloqueio.' }
  }

  revalidatePath('/admin/dashboard/bloqueios')
  return { ok: true, id: created.id }
}

const DeleteInput = z.object({ id: z.string().uuid() })

export type DeleteBlockInput = z.infer<typeof DeleteInput>
export type DeleteBlockResult = { ok: true } | { ok: false; error: string }

export async function deleteBlock(raw: DeleteBlockInput): Promise<DeleteBlockResult> {
  let user
  try {
    user = await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
  }

  const parsed = DeleteInput.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Dados inválidos.' }

  const tenantId = user.profile.tenantId
  if (!tenantId) return { ok: false, error: 'Sem tenant associado.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('availability_blocks')
    .delete()
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/dashboard/bloqueios')
  return { ok: true }
}
