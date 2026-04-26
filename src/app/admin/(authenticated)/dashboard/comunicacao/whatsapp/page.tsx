import type { UpsertTemplateInput } from '@/app/admin/(authenticated)/actions/templates'
import { TemplatesEditor, type TemplateRow } from '@/components/dashboard/templates-editor'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'

type WhatsappEvent = Extract<
  UpsertTemplateInput['event'],
  'BOOKING_CONFIRMATION' | 'BOOKING_REMINDER' | 'BOOKING_CANCELLATION' | 'SHARE_LINK' | 'CUSTOM'
>

const WHATSAPP_EVENTS: readonly WhatsappEvent[] = [
  'BOOKING_CONFIRMATION',
  'BOOKING_REMINDER',
  'BOOKING_CANCELLATION',
  'SHARE_LINK',
  'CUSTOM',
] as const

const DEFAULTS: Record<WhatsappEvent, string> = {
  BOOKING_CONFIRMATION:
    'Oi {nome}, seu agendamento de {servico} com {profissional} está confirmado para {horario}. Qualquer coisa, me avisa por aqui!',
  BOOKING_REMINDER: 'Oi {nome}, lembrete: você tem {servico} {horario}. Te espero!',
  BOOKING_CANCELLATION:
    'Oi {nome}, precisei cancelar seu agendamento de {servico} para {horario}. Me chama pra remarcar?',
  SHARE_LINK: 'Oi! Agora você pode agendar comigo direto por aqui: {link}',
  CUSTOM: 'Oi {nome}, ',
}

export default async function WhatsappPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const supabase = await createClient()
  const { data } = await supabase
    .from('tenant_message_templates')
    .select('event, enabled, subject, body')
    .eq('tenant_id', tenant.id)
    .eq('channel', 'WHATSAPP')

  const byEvent = new Map((data ?? []).map((t) => [t.event, t]))

  const templates: TemplateRow[] = WHATSAPP_EVENTS.map((event) => {
    const existing = byEvent.get(event)
    return {
      channel: 'WHATSAPP',
      event,
      enabled: existing?.enabled ?? true,
      subject: null,
      body: existing?.body ?? DEFAULTS[event],
    }
  })

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Comunicação
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          WhatsApp
        </h1>
        <p className="mt-1 text-[0.9375rem] text-fg-muted">
          Mensagens prontas pra você enviar pelo seu WhatsApp pessoal. Não enviamos
          automaticamente — você revisa antes.
        </p>
      </header>
      <TemplatesEditor channel="WHATSAPP" templates={templates} />
    </main>
  )
}
