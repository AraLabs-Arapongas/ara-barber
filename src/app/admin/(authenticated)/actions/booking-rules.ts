'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assertStaff, AuthError } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'

const SLOT_INTERVALS = [5, 10, 15, 20, 30, 60] as const

const Input = z.object({
  min_advance_hours: z
    .number()
    .int('Antecedência deve ser um inteiro.')
    .min(0, 'Antecedência mínima é 0h.')
    .max(168, 'Antecedência máxima é 168h (7 dias).'),
  slot_interval_minutes: z
    .number()
    .int()
    .refine((v) => (SLOT_INTERVALS as readonly number[]).includes(v), {
      message: 'Intervalo inválido.',
    }),
  cancellation_window_hours: z
    .number()
    .int('Janela de cancelamento deve ser um inteiro.')
    .min(0, 'Janela mínima é 0h.')
    .max(168, 'Janela máxima é 168h (7 dias).'),
  customer_can_cancel: z.boolean(),
})

export type UpdateBookingRulesInput = z.infer<typeof Input>

export type UpdateBookingRulesResult = { ok: true } | { ok: false; error: string }

/**
 * Atualiza as regras de agendamento do tenant.
 *
 * Restrito a BUSINESS_OWNER (defense in depth — RLS também bloqueia via
 * policy `tenants_owner_update_own`). Checamos linhas afetadas pra detectar
 * silent denial caso a policy seja modificada no futuro.
 *
 * TODO(follow-up): aplicar `min_advance_hours`, `slot_interval_minutes` e
 * `customer_can_cancel` no cálculo de slots e na ação de cancelamento. Esta
 * fase só persiste a configuração — runtime enforcement vem em commit
 * separado pra evitar mexer no slot calculator junto com a UI.
 */
export async function updateBookingRules(
  raw: UpdateBookingRulesInput,
): Promise<UpdateBookingRulesResult> {
  let user
  try {
    user = await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
  }

  if (user.profile.role !== 'BUSINESS_OWNER') {
    return {
      ok: false,
      error: 'Apenas o dono do negócio pode editar essas regras.',
    }
  }

  const tenant = await getCurrentTenantOrNotFound()
  const parsed = Input.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tenants')
    .update(parsed.data)
    .eq('id', tenant.id)
    .select('id')

  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) {
    return { ok: false, error: 'Não foi possível salvar (sem permissão).' }
  }

  revalidatePath('/admin/dashboard/regras')
  return { ok: true }
}
