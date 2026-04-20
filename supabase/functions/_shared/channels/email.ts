import { Resend } from 'npm:resend@4.0.0'
import { createAdminClient } from '../supabase-admin.ts'

type SendArgs = {
  to: string
  subject: string
  html: string
  replyTo?: string | null
  tenantId: string
  appointmentId: string
  event: 'confirmation' | 'cancellation'
}

export async function sendEmail(args: SendArgs) {
  const apiKey = Deno.env.get('RESEND_API_KEY')!
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')!
  const fromName = Deno.env.get('RESEND_FROM_NAME')!
  const resend = new Resend(apiKey)
  const client = createAdminClient()

  try {
    const { error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      replyTo: args.replyTo ?? undefined,
    })

    if (error) {
      await client.from('notification_log').insert({
        tenant_id: args.tenantId,
        appointment_id: args.appointmentId,
        channel: 'email',
        event: args.event,
        recipient: args.to,
        status: 'failed',
        error_message: error.message ?? JSON.stringify(error),
      })
      return { ok: false as const }
    }

    await client.from('notification_log').insert({
      tenant_id: args.tenantId,
      appointment_id: args.appointmentId,
      channel: 'email',
      event: args.event,
      recipient: args.to,
      status: 'sent',
    })
    return { ok: true as const }
  } catch (err) {
    await client.from('notification_log').insert({
      tenant_id: args.tenantId,
      appointment_id: args.appointmentId,
      channel: 'email',
      event: args.event,
      recipient: args.to,
      status: 'failed',
      error_message: err instanceof Error ? err.message : String(err),
    })
    return { ok: false as const }
  }
}
