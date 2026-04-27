'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { AgendaAppointment, AppointmentStatus } from '@/lib/appointments/queries'

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

  if (error || !data) {
    console.error('createAppointment insert error:', error)
    return { ok: false, error: 'Falha ao criar reserva.' }
  }

  revalidatePath('/admin/dashboard/agenda')
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
export async function cancelCustomerAppointment(raw: CancelByCustomerInput): Promise<CancelResult> {
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
  if (!appt) return { ok: false, error: 'Reserva não encontrada.' }

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
    return { ok: false, error: 'Essa reserva não pode mais ser cancelada.' }
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

type FetchRow = {
  id: string
  start_at: string
  end_at: string
  status: AppointmentStatus
  customer_id: string | null
  professional_id: string
  service_id: string
  customer_name_snapshot: string | null
  price_cents_snapshot: number | null
  notes: string | null
  customer: { name: string | null } | null
  service: { name: string } | null
  professional: { name: string } | null
}

export type FetchCustomerAppointmentResult =
  | { ok: true; appointment: AgendaAppointment }
  | { ok: false; error: 'not-found' | 'invalid' }

/**
 * Fetch de um único appointment do próprio cliente. RLS já restringe ao owner.
 * Usado como fallback quando o cache client-side não tem o dado (acesso via URL
 * direta, refresh, etc).
 */
export async function fetchCustomerAppointment(
  appointmentId: string,
): Promise<FetchCustomerAppointmentResult> {
  const parsed = z.string().uuid().safeParse(appointmentId)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  const supabase = await createClient()
  const { data } = await supabase
    .from('appointments')
    .select(
      `id, start_at, end_at, status, customer_id, professional_id, service_id,
       customer_name_snapshot, price_cents_snapshot, notes,
       customer:customers(name),
       service:services(name),
       professional:professionals(name)`,
    )
    .eq('id', parsed.data)
    .maybeSingle()

  const row = (data as unknown as FetchRow | null) ?? null
  if (!row) return { ok: false, error: 'not-found' }

  return {
    ok: true,
    appointment: {
      id: row.id,
      startAt: row.start_at,
      endAt: row.end_at,
      status: row.status,
      customerName: row.customer?.name ?? row.customer_name_snapshot ?? null,
      serviceName: row.service?.name ?? null,
      professionalName: row.professional?.name ?? null,
      customerId: row.customer_id,
      professionalId: row.professional_id,
      serviceId: row.service_id,
      priceCentsSnapshot: row.price_cents_snapshot,
      notes: row.notes,
    },
  }
}
