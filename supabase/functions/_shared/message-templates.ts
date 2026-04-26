import { createAdminClient } from './supabase-admin.ts'

/**
 * Template carregado do DB (`tenant_message_templates`) ou fallback hard-coded.
 *
 * `subject` é null pra channel WHATSAPP. Pra EMAIL nunca deveria vir vazio
 * mas mantemos o tipo nullable porque o schema da tabela permite NULL.
 */
export type LoadedTemplate = {
  enabled: boolean
  subject: string | null
  body: string
}

export type TemplateChannel = 'EMAIL' | 'WHATSAPP'

export type TemplateEvent =
  | 'BOOKING_CONFIRMATION'
  | 'BOOKING_CANCELLATION'
  | 'BOOKING_REMINDER'
  | 'BOOKING_THANKS'

/**
 * Defaults usados quando a row do tenant não existe na tabela
 * `tenant_message_templates`. Mantém paridade com `DEFAULTS` do
 * `src/app/admin/(authenticated)/dashboard/comunicacao/emails/page.tsx`
 * (e do equivalente WHATSAPP).
 *
 * IMPORTANTE: ao mudar copy aqui, atualizar o equivalente no admin pra que
 * o staff veja o texto efetivamente em uso.
 */
const FALLBACK_TEMPLATES: Record<
  string,
  { subject: string | null; body: string }
> = {
  EMAIL_BOOKING_CONFIRMATION: {
    subject: 'Seu agendamento foi confirmado',
    body: 'Oi {nome}, seu agendamento de {servico} com {profissional} está confirmado para {horario}.',
  },
  EMAIL_BOOKING_CANCELLATION: {
    subject: 'Seu agendamento foi cancelado',
    body: 'Oi {nome}, infelizmente seu agendamento de {servico} para {horario} foi cancelado.',
  },
  EMAIL_BOOKING_REMINDER: {
    subject: 'Lembrete do seu agendamento',
    body: 'Oi {nome}, lembrete: você tem {servico} com {profissional} {horario}.',
  },
  EMAIL_BOOKING_THANKS: {
    subject: 'Obrigado pela visita',
    body: 'Oi {nome}, obrigado pela visita! Esperamos te ver em breve.',
  },
  WHATSAPP_BOOKING_CONFIRMATION: {
    subject: null,
    body: 'Oi {nome}, seu agendamento de {servico} com {profissional} está confirmado para {horario}.',
  },
  WHATSAPP_BOOKING_CANCELLATION: {
    subject: null,
    body: 'Oi {nome}, infelizmente seu agendamento de {servico} para {horario} foi cancelado.',
  },
  WHATSAPP_BOOKING_REMINDER: {
    subject: null,
    body: 'Oi {nome}, lembrete: você tem {servico} com {profissional} {horario}.',
  },
}

/**
 * Carrega o template `(tenant_id, channel, event)` do DB. Quando a row
 * não existe, retorna o fallback hard-coded com `enabled=true`. Quando
 * existe mas `subject`/`body` vêm nulos/vazios, usa o fallback como
 * defesa em profundidade.
 */
export async function loadTemplate(
  tenantId: string,
  channel: TemplateChannel,
  event: TemplateEvent,
): Promise<LoadedTemplate> {
  const fallback = FALLBACK_TEMPLATES[`${channel}_${event}`]
  if (!fallback) {
    throw new Error(`No fallback template defined for ${channel}/${event}`)
  }

  const client = createAdminClient()
  const { data, error } = await client
    .from('tenant_message_templates')
    .select('enabled, subject, body')
    .eq('tenant_id', tenantId)
    .eq('channel', channel)
    .eq('event', event)
    .maybeSingle()

  if (error) {
    // Falha silenciosa cai no fallback — mas precisamos saber se aconteceu
    // (ex: RLS denial, schema drift, network) pra não enviar template antigo
    // achando que o staff não customizou.
    console.error(
      `loadTemplate query failed for tenant=${tenantId} ${channel}/${event}`,
      error,
    )
  }

  if (!data) {
    return { enabled: true, subject: fallback.subject, body: fallback.body }
  }

  return {
    enabled: data.enabled,
    subject:
      channel === 'EMAIL'
        ? (data.subject && data.subject.trim()) || fallback.subject
        : null,
    body: (data.body && data.body.trim()) || fallback.body,
  }
}

/**
 * Substitui placeholders `{chave}` no body por valores. Espelha
 * `applyTemplate` em `src/lib/contact/whatsapp.ts` — placeholders sem
 * valor (undefined/null/string vazia) permanecem literais pra ficar
 * visível ao staff que falta dado.
 */
export function applyTemplate(
  body: string,
  vars: Record<string, string | undefined | null>,
): string {
  return body.replace(/\{(\w+)\}/g, (match, key) => {
    const v = Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : undefined
    return v == null || v === '' ? match : v
  })
}
