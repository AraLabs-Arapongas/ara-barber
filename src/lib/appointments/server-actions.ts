'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const CreateInput = z.object({
  tenantId: z.string().uuid(),
  customerId: z.string().uuid(),
  professionalId: z.string().uuid(),
  serviceId: z.string().uuid(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  customerNameSnapshot: z.string().min(1),
  priceCentsSnapshot: z.number().int().nonnegative(),
  notes: z.string().max(500).optional(),
})

export type CreateAppointmentInput = z.infer<typeof CreateInput>
export type CreateAppointmentResult =
  | { ok: true; appointmentId: string }
  | { ok: false; error: string }

/**
 * Cria um novo appointment após validar conflito via Postgres function.
 * RLS garante que customer_id corresponde ao auth.uid() (policy appointments_customer_insert).
 */
export async function createAppointment(
  raw: CreateAppointmentInput,
): Promise<CreateAppointmentResult> {
  const parsed = CreateInput.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Dados inválidos.' }
  const input = parsed.data

  const supabase = await createClient()

  const { data: noConflict, error: checkErr } = await supabase.rpc(
    'validate_appointment_conflict',
    {
      p_tenant_id: input.tenantId,
      p_professional_id: input.professionalId,
      p_start_at: input.startAt,
      p_end_at: input.endAt,
    },
  )
  if (checkErr) return { ok: false, error: 'Falha ao checar disponibilidade.' }
  if (!noConflict) return { ok: false, error: 'Horário não disponível. Escolha outro.' }

  const { data, error } = await supabase
    .from('appointments')
    .insert({
      tenant_id: input.tenantId,
      customer_id: input.customerId,
      professional_id: input.professionalId,
      service_id: input.serviceId,
      start_at: input.startAt,
      end_at: input.endAt,
      customer_name_snapshot: input.customerNameSnapshot,
      price_cents_snapshot: input.priceCentsSnapshot,
      notes: input.notes ?? null,
    })
    .select('id')
    .single()

  if (error || !data) return { ok: false, error: 'Falha ao criar agendamento.' }

  revalidatePath('/salon/dashboard/agenda')
  revalidatePath('/meus-agendamentos')
  return { ok: true, appointmentId: data.id }
}

const CancelByCustomerInput = z.object({
  appointmentId: z.string().uuid(),
  reason: z.string().max(500).optional(),
})

export type CancelByCustomerInput = z.infer<typeof CancelByCustomerInput>
export type CancelResult = { ok: true } | { ok: false; error: string }

/**
 * Cancelamento iniciado pelo cliente. Valida janela e ownership.
 * RLS em appointments_customer_update garante que o customer só pode mudar
 * os próprios appointments.
 */
export async function cancelCustomerAppointment(
  raw: CancelByCustomerInput,
): Promise<CancelResult> {
  const parsed = CancelByCustomerInput.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Dados inválidos.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Não autenticado.' }

  const { data: appt } = await supabase
    .from('appointments')
    .select('id, tenant_id, status, start_at, end_at, customer_id')
    .eq('id', parsed.data.appointmentId)
    .maybeSingle()
  if (!appt) return { ok: false, error: 'Agendamento não encontrado.' }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('cancellation_window_hours')
    .eq('id', appt.tenant_id)
    .maybeSingle()

  const windowHours = tenant?.cancellation_window_hours ?? 2
  const cutoff = new Date(appt.start_at).getTime() - windowHours * 60 * 60 * 1000
  if (Date.now() > cutoff) {
    return { ok: false, error: `Cancelamento só até ${windowHours}h antes.` }
  }
  if (appt.status !== 'SCHEDULED' && appt.status !== 'CONFIRMED') {
    return { ok: false, error: 'Esse agendamento não pode mais ser cancelado.' }
  }

  const { error: updateErr } = await supabase
    .from('appointments')
    .update({
      status: 'CANCELED',
      canceled_at: new Date().toISOString(),
      canceled_by: user.id,
      cancel_reason: parsed.data.reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', appt.id)

  if (updateErr) return { ok: false, error: 'Falha ao cancelar.' }

  revalidatePath('/meus-agendamentos')
  return { ok: true }
}
