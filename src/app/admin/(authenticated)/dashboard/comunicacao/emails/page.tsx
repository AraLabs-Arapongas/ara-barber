import type { UpsertTemplateInput } from '@/app/admin/(authenticated)/actions/templates'
import { TemplatesEditor, type TemplateRow } from '@/components/dashboard/templates-editor'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'

type EmailEvent = Extract<
  UpsertTemplateInput['event'],
  'BOOKING_CONFIRMATION' | 'BOOKING_CANCELLATION' | 'BOOKING_REMINDER' | 'BOOKING_THANKS'
>

const EMAIL_EVENTS: readonly EmailEvent[] = [
  'BOOKING_CONFIRMATION',
  'BOOKING_CANCELLATION',
  'BOOKING_REMINDER',
  'BOOKING_THANKS',
] as const

const DEFAULTS: Record<EmailEvent, { subject: string; body: string }> = {
  BOOKING_CONFIRMATION: {
    subject: 'Seu agendamento foi confirmado',
    body: 'Oi {nome}, seu agendamento de {servico} com {profissional} está confirmado para {horario}.',
  },
  BOOKING_CANCELLATION: {
    subject: 'Seu agendamento foi cancelado',
    body: 'Oi {nome}, infelizmente seu agendamento de {servico} para {horario} foi cancelado.',
  },
  BOOKING_REMINDER: {
    subject: 'Lembrete do seu agendamento',
    body: 'Oi {nome}, lembrete: você tem {servico} com {profissional} {horario}.',
  },
  BOOKING_THANKS: {
    subject: 'Obrigado pela visita',
    body: 'Oi {nome}, obrigado pela visita! Esperamos te ver em breve.',
  },
}

export default async function EmailsPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const supabase = await createClient()
  const { data } = await supabase
    .from('tenant_message_templates')
    .select('event, enabled, subject, body')
    .eq('tenant_id', tenant.id)
    .eq('channel', 'EMAIL')

  const byEvent = new Map((data ?? []).map((t) => [t.event, t]))

  const templates: TemplateRow[] = EMAIL_EVENTS.map((event) => {
    const existing = byEvent.get(event)
    const fallback = DEFAULTS[event]
    return {
      channel: 'EMAIL',
      event,
      enabled: existing?.enabled ?? true,
      subject: existing?.subject ?? fallback.subject,
      body: existing?.body ?? fallback.body,
    }
  })

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Comunicação
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          E-mails automáticos
        </h1>
        <p className="mt-1 text-[0.9375rem] text-fg-muted">
          Mensagens que vão por e-mail pros seus clientes. Edite o conteúdo ou desligue o
          envio individualmente.
        </p>
      </header>
      <TemplatesEditor channel="EMAIL" templates={templates} />
    </main>
  )
}
