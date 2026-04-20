'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/tenant/context'

const saveSchema = z.object({
  endpoint: z.string().url(),
  p256dhKey: z.string().min(1),
  authKey: z.string().min(1),
  userAgent: z.string().optional(),
})

export async function savePushSubscription(raw: z.infer<typeof saveSchema>) {
  const parsed = saveSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: 'Payload inválido.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'Não autenticado.' }

  const tenantId = await getCurrentTenantId()

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      tenant_id: tenantId,
      endpoint: parsed.data.endpoint,
      p256dh_key: parsed.data.p256dhKey,
      auth_key: parsed.data.authKey,
      user_agent: parsed.data.userAgent ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,endpoint' },
  )

  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

export async function deleteMyPushSubscription(endpoint: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'Não autenticado.' }
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}
