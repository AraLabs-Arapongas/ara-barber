import { createAdminClient } from '../_shared/supabase-admin.ts'
import { sendPushToUser } from '../_shared/channels/push.ts'
import { formatTime } from '../_shared/format.ts'

type Window = '24h' | '2h'

type Candidate = {
  id: string
  tenant_id: string
  start_at: string
  service_name: string
  customer_user_id: string | null
}

async function processWindow(window: Window) {
  const client = createAdminClient()
  const flagColumn = window === '24h' ? 'reminder_24h_sent_at' : 'reminder_2h_sent_at'
  const lower = window === '24h' ? '23 hours 55 minutes' : '1 hour 55 minutes'
  const upper = window === '24h' ? '24 hours 5 minutes' : '2 hours 5 minutes'

  const { data: rows, error } = await client.rpc('select_reminder_candidates', {
    p_flag_column: flagColumn,
    p_lower_interval: lower,
    p_upper_interval: upper,
  })

  if (error || !rows) {
    console.error('query failed', error)
    return { processed: 0, sent: 0 }
  }

  let sent = 0
  for (const row of rows as Candidate[]) {
    if (!row.customer_user_id) continue

    const r = await sendPushToUser(row.customer_user_id, {
      title: window === '24h' ? 'Lembrete: amanhã' : 'Lembrete: em 2h',
      body: `${row.service_name} às ${formatTime(row.start_at)}`,
      url: `/meus-agendamentos/${row.id}`,
      tag: `reminder-${window}-${row.id}`,
    })

    await client
      .from('appointments')
      .update({ [flagColumn]: new Date().toISOString() })
      .eq('id', row.id)
      .is(flagColumn, null)

    await client.from('notification_log').insert({
      tenant_id: row.tenant_id,
      appointment_id: row.id,
      channel: 'push',
      event: window === '24h' ? 'reminder_24h' : 'reminder_2h',
      recipient: row.customer_user_id,
      status: r.sent > 0 ? 'sent' : 'failed',
      error_message: r.sent === 0 ? 'no successful push send' : null,
    })

    if (r.sent > 0) sent++
  }

  return { processed: rows.length, sent }
}

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET')
  const auth = req.headers.get('authorization') ?? ''
  if (!cronSecret || !auth.startsWith('Bearer ') || auth.slice(7) !== cronSecret) {
    return new Response('unauthorized', { status: 401 })
  }

  try {
    const [r24, r2] = await Promise.all([processWindow('24h'), processWindow('2h')])
    return new Response(JSON.stringify({ r24, r2 }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  } catch (err) {
    console.error('send-reminders error', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500 },
    )
  }
})
