'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertStaff, AuthError } from '@/lib/auth/guards'
import { getProfessionalUsage } from '@/lib/billing/professional-quota'

const CreateInput = z.object({
  name: z.string().min(1).max(200),
  displayName: z.string().max(100).optional(),
  phone: z.string().max(32).optional(),
  /**
   * Quando o tenant já está no limite incluído do plano, o staff
   * precisa confirmar explicitamente que aceita a cobrança extra.
   * O cliente abre um modal de confirmação e re-submete com este flag.
   */
  acknowledgeExtraCharge: z.boolean().optional(),
})

const ToggleInput = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
  acknowledgeExtraCharge: z.boolean().optional(),
})

const DeleteInput = z.object({
  id: z.string().uuid(),
})

/** Resultado simples — ações que não envolvem cota. */
export type SimpleResult = { ok: true } | { ok: false; error: string }

/** Resultado das ações que mexem em cota (criar/reativar). */
export type QuotaResult =
  | { ok: true }
  | { ok: false; error: string }
  | {
      ok: false
      requiresExtraChargeConfirmation: true
      extraUnitPriceCents: number
      currentExtraMonthlyCents: number
      newExtraMonthlyCents: number
      activeCount: number
      included: number
    }

function authError(): { ok: false; error: string } {
  return { ok: false, error: 'Sem permissão.' }
}

export async function createProfessional(
  raw: z.infer<typeof CreateInput>,
): Promise<QuotaResult> {
  const parsed = CreateInput.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Dados inválidos.' }

  let user
  try {
    user = await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return authError()
    throw e
  }

  const tenantId = user.profile.tenantId
  if (!tenantId) return authError()

  // Cota: bloqueia o 1º que ultrapassa até receber confirmação explícita.
  const usage = await getProfessionalUsage(tenantId)
  if (usage.willExceedOnAdd && !parsed.data.acknowledgeExtraCharge) {
    const newExtraCount = usage.extraCount + 1
    return {
      ok: false,
      requiresExtraChargeConfirmation: true,
      extraUnitPriceCents: usage.extraUnitPriceCents,
      currentExtraMonthlyCents: usage.extraMonthlyCents,
      newExtraMonthlyCents: newExtraCount * usage.extraUnitPriceCents,
      activeCount: usage.activeCount,
      included: usage.included,
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('professionals').insert({
    tenant_id: tenantId,
    name: parsed.data.name.trim(),
    display_name: parsed.data.displayName?.trim() || null,
    phone: parsed.data.phone?.trim() || null,
    is_active: true,
  })

  if (error) return { ok: false, error: 'Falha ao criar profissional.' }

  revalidatePath('/admin/dashboard/profissionais')
  revalidatePath('/admin/dashboard/equipe-servicos')
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
): Promise<SimpleResult> {
  const parsed = UpdateInput.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Dados inválidos.' }

  let user
  try {
    user = await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return authError()
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

  revalidatePath('/admin/dashboard/profissionais')
  revalidatePath('/admin/dashboard/equipe-servicos')
  return { ok: true }
}

export async function toggleProfessionalActive(
  raw: z.infer<typeof ToggleInput>,
): Promise<QuotaResult> {
  const parsed = ToggleInput.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Dados inválidos.' }

  let user
  try {
    user = await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return authError()
    throw e
  }

  const tenantId = user.profile.tenantId
  if (!tenantId) return authError()

  // Reativar também conta na cota — pede confirmação se estourar.
  if (parsed.data.isActive) {
    const usage = await getProfessionalUsage(tenantId)
    if (usage.willExceedOnAdd && !parsed.data.acknowledgeExtraCharge) {
      const newExtraCount = usage.extraCount + 1
      return {
        ok: false,
        requiresExtraChargeConfirmation: true,
        extraUnitPriceCents: usage.extraUnitPriceCents,
        currentExtraMonthlyCents: usage.extraMonthlyCents,
        newExtraMonthlyCents: newExtraCount * usage.extraUnitPriceCents,
        activeCount: usage.activeCount,
        included: usage.included,
      }
    }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('professionals')
    .update({ is_active: parsed.data.isActive, updated_at: new Date().toISOString() })
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)

  if (error) return { ok: false, error: 'Falha ao atualizar.' }

  revalidatePath('/admin/dashboard/profissionais')
  revalidatePath('/admin/dashboard/equipe-servicos')
  return { ok: true }
}

/**
 * Hard delete. Só permite se o profissional estiver inativo E não
 * tiver nenhum agendamento no histórico (FK preserva integridade dos
 * relatórios). Pra quem teve atividade real, o caminho é manter
 * inativo pra sempre.
 */
export async function deleteProfessional(
  raw: z.infer<typeof DeleteInput>,
): Promise<SimpleResult> {
  const parsed = DeleteInput.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Dados inválidos.' }

  let user
  try {
    user = await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return authError()
    throw e
  }

  const tenantId = user.profile.tenantId
  if (!tenantId) return authError()
  const supabase = await createClient()

  // Verifica que está inativo
  const { data: prof } = await supabase
    .from('professionals')
    .select('id, is_active')
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!prof) return { ok: false, error: 'Profissional não encontrado.' }
  if (prof.is_active) {
    return { ok: false, error: 'Desative o profissional antes de excluir.' }
  }

  // Verifica que não tem agendamentos
  const { count: apptCount } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('professional_id', parsed.data.id)
    .eq('tenant_id', tenantId)

  if ((apptCount ?? 0) > 0) {
    return {
      ok: false,
      error:
        'Tem agendamentos no histórico. Mantenha desativado pra preservar os relatórios.',
    }
  }

  const { error } = await supabase
    .from('professionals')
    .delete()
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)

  if (error) return { ok: false, error: 'Falha ao excluir profissional.' }

  revalidatePath('/admin/dashboard/profissionais')
  revalidatePath('/admin/dashboard/equipe-servicos')
  return { ok: true }
}
