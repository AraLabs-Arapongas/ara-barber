'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assertStaff, AuthError } from '@/lib/auth/guards'
import { recordAudit } from '@/lib/audit/log'
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
  booking_window_days: z
    .number()
    .int('Janela de agendamento deve ser um inteiro.')
    .min(1, 'Mínimo 1 dia.')
    .max(365, 'Máximo 365 dias.'),
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
 * Runtime enforcement das regras:
 *   - `min_advance_hours` + `slot_interval_minutes`: aplicados no
 *     `computeSlots()` (`src/lib/booking/slots.ts`) — staff IGNORA
 *     `min_advance_hours` (pode bookar walk-in pra agora).
 *   - `customer_can_cancel`: validado em `cancelCustomerAppointment()`
 *     (`src/lib/appointments/server-actions.ts`).
 *   - `cancellation_window_hours`: validado em `cancelCustomerAppointment()`.
 *   - `booking_window_days`: aplicado no `getCustomerBookingContext()`
 *     (`src/lib/booking/customer-context.ts`).
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

  await recordAudit({
    tenantId: tenant.id,
    actorUserId: user.id,
    actorRole: user.profile.role,
    action: 'tenant.rules.update',
    entityType: 'tenant',
    entityId: tenant.id,
    changes: parsed.data,
  })

  revalidatePath('/admin/dashboard/regras')
  return { ok: true }
}
