'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assertStaff, AuthError } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'

const Channel = z.enum(['EMAIL', 'WHATSAPP'])

/**
 * Eventos suportados em `tenant_message_templates`.
 *
 * EMAIL usa BOOKING_* (mensagens transacionais disparadas pelo sistema).
 * WHATSAPP adiciona SHARE_LINK e CUSTOM (mensagens manuais que o staff
 * dispara de dentro do app — ex: botão "Enviar pelo WhatsApp" no detalhe
 * do agendamento). A combinação (channel, event) tem unique constraint
 * em DB; o upsert abaixo respeita esse contrato.
 */
const Event = z.enum([
  'BOOKING_CONFIRMATION',
  'BOOKING_CANCELLATION',
  'BOOKING_REMINDER',
  'BOOKING_THANKS',
  'SHARE_LINK',
  'CUSTOM',
])

const UpsertInput = z.object({
  channel: Channel,
  event: Event,
  enabled: z.boolean(),
  subject: z.string().max(200).optional().or(z.literal('')),
  body: z.string().min(1, 'Mensagem não pode ficar vazia.').max(2000),
})

export type UpsertTemplateInput = z.infer<typeof UpsertInput>

export type UpsertTemplateResult = { ok: true } | { ok: false; error: string }

/**
 * Insere/atualiza um template de mensagem do tenant.
 *
 * RLS: a policy `tenant_message_templates_staff_all` libera qualquer staff
 * (BUSINESS_OWNER, RECEPTIONIST, PROFESSIONAL) — então `assertStaff()` sem
 * restrição por role é suficiente.
 *
 * Subject só faz sentido pra EMAIL; pra WHATSAPP forçamos NULL pra evitar
 * dados zumbi caso o channel seja trocado depois.
 */
export async function upsertTemplate(raw: UpsertTemplateInput): Promise<UpsertTemplateResult> {
  try {
    await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
  }

  const tenant = await getCurrentTenantOrNotFound()
  const parsed = UpsertInput.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Input inválido.' }
  }

  const data = parsed.data
  const supabase = await createClient()

  const { error } = await supabase.from('tenant_message_templates').upsert(
    {
      tenant_id: tenant.id,
      channel: data.channel,
      event: data.event,
      enabled: data.enabled,
      subject: data.channel === 'EMAIL' ? data.subject || null : null,
      body: data.body,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id,channel,event' },
  )
  if (error) return { ok: false, error: error.message }

  revalidatePath(
    `/admin/dashboard/comunicacao/${data.channel === 'EMAIL' ? 'emails' : 'whatsapp'}`,
  )
  return { ok: true }
}
