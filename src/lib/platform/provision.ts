import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { createSecretClient } from '@/lib/supabase/secret'
import type { Database } from '@/lib/supabase/types'

/**
 * Caller MUST enforce auth before invoking `provisionTenant`. This function
 * does NOT check auth itself because it's called from two contexts:
 *   1. Server Action `createTenantAction` — calls `assertPlatformAdmin()`
 *      before delegating here.
 *   2. CLI script `scripts/provision-tenant.ts` — runs with the service-role
 *      key in a no-session environment, so a session-based guard would break it.
 *
 * If you add a new caller, ensure it enforces auth (or is service-role only).
 */

export const ProvisionTenantInputSchema = z.object({
  slug: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/, 'Use só [a-z0-9-]'),
  name: z.string().min(1).max(120),
  ownerEmail: z.string().email(),
  ownerName: z.string().min(1).max(120),
  timezone: z.string().default('America/Sao_Paulo'),
  subdomain: z.string().optional(),
  skipHours: z.boolean().default(false),
})

export type ProvisionTenantInput = z.infer<typeof ProvisionTenantInputSchema>

export type ProvisionResult = {
  tenantId: string
  ownerUserId: string
  resetEmailSent: boolean
}

export async function provisionTenant(
  input: ProvisionTenantInput,
  supabase: SupabaseClient<Database> = createSecretClient(),
): Promise<ProvisionResult> {
  const subdomain = input.subdomain ?? input.slug

  // 0. Plano default — todo tenant novo entra no plano marcado como
  // is_default=true (PRO hoje). Sem plano, queries de cota/billing
  // ficam quebradas e o staff não tem como abrir conta.
  const { data: defaultPlan, error: planErr } = await supabase
    .from('plans')
    .select('id, trial_days_default')
    .eq('is_default', true)
    .eq('is_active', true)
    .maybeSingle()
  if (planErr || !defaultPlan) {
    throw new Error(
      `default plan: ${planErr?.message ?? 'nenhum plano com is_default=true e is_active=true'}`,
    )
  }

  // Trial padrão = `plan.trial_days_default`. Pioneiros (criados até
  // 31/07/2026) ganham 60 dias automaticamente via trigger
  // `tenants_set_pioneer_flag_trigger` — mas o trigger SÓ marca
  // is_pioneer/pioneer_since, não mexe em trial. Daí calculamos aqui:
  // se a data atual cai dentro da janela de pioneiros, sobrescrevemos
  // com 60 dias. Mantém o source-of-truth single (a data limite).
  const PIONEER_DEADLINE_UTC = new Date('2026-08-01T03:00:00Z')
  const isPioneerWindow = new Date() < PIONEER_DEADLINE_UTC
  const trialDays = isPioneerWindow ? 60 : defaultPlan.trial_days_default
  const trialEnds = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000)

  // 1. Tenant
  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .insert({
      slug: input.slug,
      name: input.name,
      subdomain,
      timezone: input.timezone,
      primary_color: '#0f172a',
      billing_status: 'TRIALING',
      current_plan_id: defaultPlan.id,
      trial_starts_at: new Date().toISOString(),
      trial_ends_at: trialEnds.toISOString(),
      trial_days_granted: trialDays,
      booking_window_days: 14,
      min_advance_minutes: 0,
      slot_interval_minutes: 15,
      cancellation_window_minutes: 120,
      customer_can_cancel: true,
    })
    .select('id')
    .single()
  if (tenantErr || !tenant) throw new Error(`tenant insert: ${tenantErr?.message}`)

  // 2. business_hours (Seg=1 a Sáb=6 abertos 9-18, Dom=0 fechado)
  if (!input.skipHours) {
    const hours = Array.from({ length: 7 }, (_, weekday) => ({
      tenant_id: tenant.id,
      weekday,
      is_open: weekday !== 0,
      start_time: '09:00:00',
      end_time: '18:00:00',
    }))
    const { error: hoursErr } = await supabase.from('business_hours').insert(hours)
    if (hoursErr) throw new Error(`business_hours: ${hoursErr.message}`)
  }

  // 3. Auth user — cria ou reusa
  let userId: string
  const { data: existingUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const existing = existingUsers?.users.find((u) => u.email === input.ownerEmail)

  if (existing) {
    userId = existing.id
  } else {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: input.ownerEmail,
      email_confirm: true,
      user_metadata: { name: input.ownerName },
    })
    if (createErr || !created.user) throw new Error(`auth.createUser: ${createErr?.message}`)
    userId = created.user.id
  }

  // 4. user_profiles → BUSINESS_OWNER do tenant
  const { error: profileErr } = await supabase.from('user_profiles').insert({
    user_id: userId,
    tenant_id: tenant.id,
    role: 'BUSINESS_OWNER',
    name: input.ownerName,
    is_active: true,
  })
  if (profileErr) throw new Error(`user_profiles: ${profileErr.message}`)

  // 5. OTP de boas-vindas — owner recebe código de 6 dígitos por
  // email. Cola no /admin/login e entra. Sem magic link (caminho
  // único, sem dependência de redirect URL allowlist do Supabase).
  // `shouldCreateUser`:false por segurança (user já foi criado acima).
  const { error: otpErr } = await supabase.auth.signInWithOtp({
    email: input.ownerEmail,
    options: {
      shouldCreateUser: false,
    },
  })

  return {
    tenantId: tenant.id,
    ownerUserId: userId,
    resetEmailSent: !otpErr,
  }
}
