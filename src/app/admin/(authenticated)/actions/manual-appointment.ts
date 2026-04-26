'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assertStaff, AuthError } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'

const Input = z.object({
  serviceId: z.string().uuid(),
  professionalId: z.string().uuid(),
  startAtISO: z.string().datetime(),
  // cliente: usa um dos dois caminhos
  customerId: z.string().uuid().optional(),
  customerNew: z
    .object({
      name: z.string().min(1).max(120),
      phone: z.string().min(8).max(20).optional(),
      email: z.string().email().optional().or(z.literal('')),
    })
    .optional(),
  notes: z.string().max(500).optional(),
})

export type CreateManualAppointmentInput = z.infer<typeof Input>

export type CreateManualAppointmentResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

/**
 * Criação manual feita pelo staff (sem fluxo OTP).
 *
 * - Resolve cliente: usa `customerId` existente OU cria novo on-the-fly (sem
 *   `user_id` — `customers.user_id` é nullable desde 20260422031935).
 * - Carrega serviço pra duração + snapshot de preço.
 * - Re-checa conflito server-side via `validate_appointment_conflict` RPC.
 * - Insere appointment com `status=CONFIRMED` (staff já confirma de cara).
 *
 * NOTA: appointments não tem `service_name_snapshot` nem `created_via`,
 * customers não tem `source` — não inserimos esses campos aqui.
 */
export async function createManualAppointment(
  raw: CreateManualAppointmentInput,
): Promise<CreateManualAppointmentResult> {
  try {
    await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
  }

  const tenant = await getCurrentTenantOrNotFound()
  const parsed = Input.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }
  const data = parsed.data

  if (!data.customerId && !data.customerNew) {
    return { ok: false, error: 'Cliente obrigatório.' }
  }

  const supabase = await createClient()

  // 1. resolver cliente
  let customerId = data.customerId
  let customerNameSnapshot: string | null = null

  if (!customerId && data.customerNew) {
    const { data: created, error: createErr } = await supabase
      .from('customers')
      .insert({
        tenant_id: tenant.id,
        name: data.customerNew.name,
        phone: data.customerNew.phone || null,
        email: data.customerNew.email || null,
      })
      .select('id, name')
      .single()
    if (createErr || !created) {
      return { ok: false, error: createErr?.message ?? 'Falha ao criar cliente.' }
    }
    customerId = created.id
    customerNameSnapshot = created.name
  } else if (customerId) {
    const { data: existing } = await supabase
      .from('customers')
      .select('name')
      .eq('id', customerId)
      .eq('tenant_id', tenant.id)
      .maybeSingle()
    if (!existing) return { ok: false, error: 'Cliente não encontrado.' }
    customerNameSnapshot = existing.name
  }

  // 2. carregar serviço (duração + preço snapshot)
  const { data: service } = await supabase
    .from('services')
    .select('id, duration_minutes, price_cents, is_active')
    .eq('id', data.serviceId)
    .eq('tenant_id', tenant.id)
    .maybeSingle()
  if (!service || !service.is_active) {
    return { ok: false, error: 'Serviço inválido.' }
  }

  const startAt = new Date(data.startAtISO)
  const endAt = new Date(startAt.getTime() + service.duration_minutes * 60_000)

  // 3. re-check de conflito server-side via RPC (defesa em profundidade)
  const { data: noConflict, error: conflictErr } = await supabase.rpc(
    'validate_appointment_conflict',
    {
      p_tenant_id: tenant.id,
      p_professional_id: data.professionalId,
      p_start_at: startAt.toISOString(),
      p_end_at: endAt.toISOString(),
    },
  )
  if (conflictErr) return { ok: false, error: 'Falha ao checar disponibilidade.' }
  if (!noConflict) return { ok: false, error: 'Horário não disponível.' }

  // 4. inserir appointment
  const { data: appt, error: insertErr } = await supabase
    .from('appointments')
    .insert({
      tenant_id: tenant.id,
      customer_id: customerId ?? null,
      professional_id: data.professionalId,
      service_id: data.serviceId,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      status: 'CONFIRMED', // staff cria já confirmado
      customer_name_snapshot: customerNameSnapshot,
      price_cents_snapshot: service.price_cents,
      notes: data.notes || null,
    })
    .select('id')
    .single()

  if (insertErr || !appt) {
    return { ok: false, error: insertErr?.message ?? 'Falha ao criar agendamento.' }
  }

  revalidatePath('/admin/dashboard')
  revalidatePath('/admin/dashboard/agenda')
  return { ok: true, id: appt.id }
}
