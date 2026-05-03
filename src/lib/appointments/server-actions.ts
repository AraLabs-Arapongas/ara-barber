'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createSecretClient } from '@/lib/supabase/secret'
import { recordAudit } from '@/lib/audit/log'
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

  // Auto-confirm: tenant pode escolher pular o estado SCHEDULED.
  // Lê via secret client porque cliente anônimo não tem RLS pra ver
  // colunas operacionais do tenant.
  const tenantConfig = createSecretClient()
  const { data: tenantCfg } = await tenantConfig
    .from('tenants')
    .select('auto_confirm_bookings')
    .eq('id', input.tenantId)
    .maybeSingle()
  const initialStatus = tenantCfg?.auto_confirm_bookings ? 'CONFIRMED' : 'SCHEDULED'

  const { data, error } = await supabase
    .from('appointments')
    .insert({
      tenant_id: input.tenantId,
      customer_id: input.customerId,
      professional_id: input.professionalId,
      service_id: input.serviceId,
      start_at: input.startAt,
      end_at: input.endAt,
      status: initialStatus,
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

  // Audit: cliente criou reserva. Lemos user só pra capturar actor;
  // RLS já garantiu autoria no insert acima.
  const {
    data: { user: actorUser },
  } = await supabase.auth.getUser()
  await recordAudit({
    tenantId: input.tenantId,
    actorUserId: actorUser?.id ?? null,
    actorRole: 'CUSTOMER',
    action: 'appointment.create',
    entityType: 'appointment',
    entityId: data.id,
    changes: {
      service_id: input.serviceId,
      professional_id: input.professionalId,
      start_at: input.startAt,
      end_at: input.endAt,
    },
  })

  revalidatePath('/admin/dashboard/agenda')
  revalidatePath('/meus-agendamentos')
  return { ok: true, appointmentId: data.id }
}

const CancelByCustomerInput = z.object({
  appointmentId: z.string().uuid(),
  reason: z.string().max(500).optional(),
})

const CancelGroupByCustomerInput = z.object({
  groupId: z.string().uuid(),
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
    .select('cancellation_window_minutes, customer_can_cancel')
    .eq('id', appt.tenant_id)
    .maybeSingle()

  // Tenant pode desligar cancelamento self-service. Cliente nesse caso
  // tem que falar com o estabelecimento direto.
  if (tenant?.customer_can_cancel === false) {
    return {
      ok: false,
      error: 'Esse estabelecimento não permite cancelamento online — entre em contato direto.',
    }
  }

  const windowHours = tenant?.cancellation_window_minutes ?? 2
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

  await recordAudit({
    tenantId: appt.tenant_id,
    actorUserId: user.id,
    actorRole: 'CUSTOMER',
    action: 'appointment.cancel',
    entityType: 'appointment',
    entityId: appt.id,
    changes: {
      status_before: appt.status,
      reason: parsed.data.reason ?? null,
    },
  })

  revalidatePath('/meus-agendamentos')
  return { ok: true }
}

/**
 * Cancela combo inteiro (todos appointments do group).
 * Valida ownership do group + janela de cancelamento contra o
 * `start_at` mais cedo. Em transação atômica via RPC
 * `cancel_appointment_group`.
 */
export async function cancelCustomerGroupBooking(
  raw: z.infer<typeof CancelGroupByCustomerInput>,
): Promise<CancelResult> {
  const parsed = CancelGroupByCustomerInput.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Dados inválidos.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Não autenticado.' }

  // RLS já bloqueia leitura de group de outro customer; double-check aqui.
  const { data: group } = await supabase
    .from('appointment_groups')
    .select('id, tenant_id, customer_id, status')
    .eq('id', parsed.data.groupId)
    .maybeSingle()
  if (!group) return { ok: false, error: 'Combo não encontrado.' }
  if (group.status !== 'SCHEDULED' && group.status !== 'CONFIRMED') {
    return { ok: false, error: 'Esse combo não pode mais ser cancelado.' }
  }

  // Validate cancellation window contra o appointment mais cedo do group.
  const { data: earliest } = await supabase
    .from('appointments')
    .select('start_at')
    .eq('group_id', group.id)
    .order('start_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!earliest) return { ok: false, error: 'Combo sem reservas.' }

  const { data: tenantData } = await supabase
    .from('tenants')
    .select('cancellation_window_minutes, customer_can_cancel')
    .eq('id', group.tenant_id)
    .maybeSingle()

  if (tenantData?.customer_can_cancel === false) {
    return {
      ok: false,
      error: 'Esse estabelecimento não permite cancelamento online — entre em contato direto.',
    }
  }

  const windowHours = tenantData?.cancellation_window_minutes ?? 2
  const cutoff = new Date(earliest.start_at).getTime() - windowHours * 60 * 60 * 1000
  if (Date.now() > cutoff) {
    return { ok: false, error: `Cancelamento só até ${windowHours}h antes.` }
  }

  // Cascata atômica via RPC.
  const { error: rpcErr } = await supabase.rpc('cancel_appointment_group', {
    p_group_id: group.id,
    p_canceled_by: user.id,
    p_reason: parsed.data.reason ?? undefined,
  })
  if (rpcErr) return { ok: false, error: 'Falha ao cancelar combo.' }

  await recordAudit({
    tenantId: group.tenant_id,
    actorUserId: user.id,
    actorRole: 'CUSTOMER',
    action: 'booking_group.cancel',
    entityType: 'appointment_group',
    entityId: group.id,
    changes: { reason: parsed.data.reason ?? null },
  })

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
  group_id: string | null
  position: number | null
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
       customer_name_snapshot, price_cents_snapshot, notes, group_id, position,
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
      groupId: row.group_id,
      position: row.position,
    },
  }
}
