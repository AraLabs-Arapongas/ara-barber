'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertStaff, AuthError } from '@/lib/auth/guards'
import { canTransition } from '@/lib/appointments/status-rules'

const StatusEnum = z.enum(['CONFIRMED', 'CANCELED', 'NO_SHOW', 'COMPLETED'])

const Input = z.object({
  appointmentId: z.string().uuid(),
  nextStatus: StatusEnum,
  reason: z.string().max(500).optional(),
})

export type TransitionInput = z.infer<typeof Input>
export type TransitionResult = { ok: true } | { ok: false; error: string }

export async function transitionAppointmentStatus(raw: TransitionInput): Promise<TransitionResult> {
  const parsed = Input.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Input inválido.' }
  const { appointmentId, nextStatus, reason } = parsed.data

  let user
  try {
    user = await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
  }

  const supabase = await createClient()
  const { data: appt, error: readErr } = await supabase
    .from('appointments')
    .select('id, tenant_id, status, start_at, end_at')
    .eq('id', appointmentId)
    .maybeSingle()

  if (readErr || !appt) return { ok: false, error: 'Agendamento não encontrado.' }

  // Garante que o staff é do mesmo tenant (RLS já faz isso, mas dupla checagem)
  if (user.profile.tenantId !== appt.tenant_id) {
    return { ok: false, error: 'Agendamento de outro negócio.' }
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('cancellation_window_hours')
    .eq('id', appt.tenant_id)
    .maybeSingle()

  const check = canTransition(appt.status, nextStatus, {
    actor: 'staff',
    now: new Date(),
    startAt: new Date(appt.start_at),
    endAt: new Date(appt.end_at),
    cancellationWindowHours: tenant?.cancellation_window_hours ?? 2,
  })
  if (!check.ok) return { ok: false, error: check.reason }

  const update: Record<string, unknown> = {
    status: nextStatus,
    updated_at: new Date().toISOString(),
  }
  if (nextStatus === 'CANCELED') {
    update.canceled_at = new Date().toISOString()
    update.canceled_by = user.id
    update.cancel_reason = reason ?? null
  }

  const { error: updateErr } = await supabase
    .from('appointments')
    .update(update)
    .eq('id', appointmentId)

  if (updateErr) return { ok: false, error: 'Falha ao atualizar. Tente novamente.' }

  revalidatePath('/admin/dashboard/agenda')
  return { ok: true }
}
