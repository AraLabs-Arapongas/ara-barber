'use server'

import { z } from 'zod'

import { createAppointment } from '@/lib/appointments/server-actions'
import { recordAudit } from '@/lib/audit/log'
import { ensureCustomerForTenant, updateMyCustomerProfile } from '@/lib/customers/ensure'
import { createClient } from '@/lib/supabase/server'

const SegmentInput = z.object({
  serviceId: z.string().uuid(),
  professionalId: z.string().uuid(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  priceCentsSnapshot: z.number().int().nonnegative(),
})

const Input = z.object({
  tenantId: z.string().uuid(),
  segments: z.array(SegmentInput).min(1, 'Selecione ao menos 1 serviço.'),
  customerName: z.string().min(1),
  customerPhone: z.string().min(10),
})

export type ConfirmBookingInput = z.infer<typeof Input>
export type ConfirmBookingResult =
  | { ok: true; kind: 'single'; appointmentId: string }
  | { ok: true; kind: 'combo'; groupId: string }
  | { ok: false; error: string }

/**
 * Confirma reserva (single ou combo).
 *
 * - 1 segment → cria appointment direto via `createAppointment` (path
 *   legado, mesmo código de hoje).
 * - N segments → chama RPC `create_combo_booking` que insere
 *   appointment_group + N appointments atomicamente, validando
 *   conflito de cada segment ANTES de qualquer insert (rollback total
 *   se algum conflitar).
 */
export async function confirmBookingAction(
  raw: ConfirmBookingInput,
): Promise<ConfirmBookingResult> {
  const parsed = Input.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Dados inválidos.' }
  const input = parsed.data

  const customer = await ensureCustomerForTenant(input.tenantId)
  if (!customer) return { ok: false, error: 'Você precisa estar logado como cliente.' }

  if (customer.name !== input.customerName || customer.phone !== input.customerPhone) {
    await updateMyCustomerProfile(customer.id, {
      name: input.customerName,
      phone: input.customerPhone,
    })
  }

  // Single: comportamento legado.
  if (input.segments.length === 1) {
    const seg = input.segments[0]
    const r = await createAppointment({
      tenantId: input.tenantId,
      customerId: customer.id,
      professionalId: seg.professionalId,
      serviceId: seg.serviceId,
      startAt: seg.startAt,
      endAt: seg.endAt,
      customerNameSnapshot: input.customerName,
      priceCentsSnapshot: seg.priceCentsSnapshot,
    })
    if (!r.ok) return r
    return { ok: true, kind: 'single', appointmentId: r.appointmentId }
  }

  // Combo: RPC atômica.
  const supabase = await createClient()
  const totalDuration = input.segments.reduce((sum, s) => {
    return sum + Math.round((new Date(s.endAt).getTime() - new Date(s.startAt).getTime()) / 60000)
  }, 0)
  const totalPrice = input.segments.reduce((sum, s) => sum + s.priceCentsSnapshot, 0)

  const segmentsPayload = input.segments.map((s, idx) => ({
    service_id: s.serviceId,
    professional_id: s.professionalId,
    start_at: s.startAt,
    end_at: s.endAt,
    price_cents_snapshot: s.priceCentsSnapshot,
    position: idx,
  }))

  const { data: groupId, error } = await supabase.rpc('create_combo_booking', {
    p_tenant_id: input.tenantId,
    p_customer_id: customer.id,
    p_customer_name_snapshot: input.customerName,
    p_total_duration_minutes: totalDuration,
    p_total_price_cents: totalPrice,
    p_segments: segmentsPayload,
  })

  if (error || !groupId) {
    return {
      ok: false,
      error: error?.message?.includes('Horário não disponível')
        ? 'Algum horário ficou indisponível. Volte e escolha outros.'
        : 'Falha ao criar combo.',
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  await recordAudit({
    tenantId: input.tenantId,
    actorUserId: user?.id ?? null,
    actorRole: 'CUSTOMER',
    action: 'booking_group.create',
    entityType: 'appointment_group',
    entityId: groupId,
    changes: {
      services: input.segments.map((s) => s.serviceId),
      total_duration_minutes: totalDuration,
      total_price_cents: totalPrice,
    },
  })

  return { ok: true, kind: 'combo', groupId }
}
