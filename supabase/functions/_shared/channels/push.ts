import webpush from 'npm:web-push@3.6.7'
import { createAdminClient } from '../supabase-admin.ts'

export type PushPayload = {
  title: string
  body: string
  url: string
  tag?: string
}

type Subscription = {
  id: string
  endpoint: string
  p256dh_key: string
  auth_key: string
}

function configureVapid() {
  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT')!,
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  )
}

async function sendOne(sub: Subscription, payload: PushPayload) {
  const client = createAdminClient()
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
      },
      JSON.stringify(payload),
      { TTL: 3600 },
    )
    return { ok: true as const }
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number })?.statusCode
    if (statusCode === 410 || statusCode === 404) {
      await client.from('push_subscriptions').delete().eq('id', sub.id)
    }
    return { ok: false as const, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  configureVapid()
  const client = createAdminClient()
  const { data: subs } = await client
    .from('push_subscriptions')
    .select('id, endpoint, p256dh_key, auth_key')
    .eq('user_id', userId)

  if (!subs || subs.length === 0) return { sent: 0, failed: 0 }

  let sent = 0
  let failed = 0
  for (const sub of subs) {
    const r = await sendOne(sub, payload)
    if (r.ok) sent++
    else failed++
  }
  return { sent, failed }
}

export async function sendPushToTenantStaff(tenantId: string, payload: PushPayload) {
  configureVapid()
  const client = createAdminClient()

  const { data: staffProfiles } = await client
    .from('user_profiles')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .in('role', ['SALON_OWNER', 'RECEPTIONIST', 'PROFESSIONAL'])
    .eq('is_active', true)

  if (!staffProfiles || staffProfiles.length === 0) return { sent: 0, failed: 0 }

  const userIds = staffProfiles.map((p) => p.user_id)
  const { data: subs } = await client
    .from('push_subscriptions')
    .select('id, endpoint, p256dh_key, auth_key')
    .in('user_id', userIds)

  if (!subs || subs.length === 0) return { sent: 0, failed: 0 }

  let sent = 0
  let failed = 0
  for (const sub of subs) {
    const r = await sendOne(sub, payload)
    if (r.ok) sent++
    else failed++
  }
  return { sent, failed }
}
