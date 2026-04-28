/* eslint-disable no-console -- CLI script: console.log é a interface de output. */
/**
 * Script de provisioning de novo tenant. Cria:
 *   1. Row em `public.tenants` com defaults sensatos
 *   2. `business_hours` para os 7 dias da semana (Seg-Sáb abertos 9-18,
 *      Dom fechado — ajustar depois pelo admin)
 *   3. Auth user pro BUSINESS_OWNER (email pré-confirmado)
 *   4. Row em `public.user_profiles` linkando user → tenant com role
 *   5. Envia email de reset de senha pro owner definir a própria
 *
 * Uso:
 *   node --env-file=.env.local scripts/provision-tenant.ts \
 *     --slug barbearia-do-fulano \
 *     --name "Barbearia do Fulano" \
 *     --owner-email fulano@example.com \
 *     --owner-name "Fulano da Silva" \
 *     [--timezone America/Sao_Paulo] \
 *     [--subdomain barbearia-do-fulano]   # default = slug
 *
 * Pré-requisitos:
 *   - .env.local com NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY
 *     apontando pro env desejado (cloud prod ou local Docker).
 *   - Node 24+ (strip de types nativo).
 *
 * Idempotência:
 *   - Tenant: falha se slug já existe (proteção — não sobrescreve).
 *   - Auth user: se email já existe, reusa o user e só linka via
 *     user_profiles. Bom pra adicionar owner existente a um novo tenant.
 *   - business_hours: insert puro; rodar 2x dá conflito de unique
 *     (tenant_id, weekday). Use --skip-hours pra pular se já existem.
 */

import { createClient } from '@supabase/supabase-js'
import { parseArgs } from 'node:util'

type Args = {
  slug: string
  name: string
  ownerEmail: string
  ownerName: string
  timezone: string
  subdomain: string
  skipHours: boolean
}

function parseCliArgs(): Args {
  const { values } = parseArgs({
    options: {
      slug: { type: 'string' },
      name: { type: 'string' },
      'owner-email': { type: 'string' },
      'owner-name': { type: 'string' },
      timezone: { type: 'string', default: 'America/Sao_Paulo' },
      subdomain: { type: 'string' },
      'skip-hours': { type: 'boolean', default: false },
    },
  })

  const required = ['slug', 'name', 'owner-email', 'owner-name'] as const
  const missing = required.filter((k) => !values[k])
  if (missing.length > 0) {
    console.error(`Faltam args obrigatórios: ${missing.join(', ')}`)
    console.error('Veja o cabeçalho do script pra exemplo de uso.')
    process.exit(1)
  }

  const slug = values.slug as string
  if (!/^[a-z0-9-]+$/.test(slug)) {
    console.error(`Slug inválido "${slug}" — use só [a-z0-9-].`)
    process.exit(1)
  }

  return {
    slug,
    name: values.name as string,
    ownerEmail: values['owner-email'] as string,
    ownerName: values['owner-name'] as string,
    timezone: (values.timezone as string) ?? 'America/Sao_Paulo',
    subdomain: (values.subdomain as string | undefined) ?? slug,
    skipHours: Boolean(values['skip-hours']),
  }
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret = process.env.SUPABASE_SECRET_KEY
  if (!url || !secret) {
    console.error(
      'Faltam env vars: NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SECRET_KEY.\n' +
        'Rode com `node --env-file=.env.local scripts/provision-tenant.ts ...`',
    )
    process.exit(1)
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function main() {
  const args = parseCliArgs()
  const supabase = getSupabaseAdmin()

  console.log(`\n→ Provisioning tenant "${args.name}" (${args.slug})...`)

  // 1. Tenant
  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .insert({
      slug: args.slug,
      name: args.name,
      subdomain: args.subdomain,
      timezone: args.timezone,
      // Defaults conservadores. Owner ajusta no admin.
      primary_color: '#0f172a',
      billing_status: 'TRIALING',
      booking_window_days: 14,
      min_advance_hours: 0,
      slot_interval_minutes: 15,
      cancellation_window_hours: 2,
      customer_can_cancel: true,
    })
    .select('id, slug, name')
    .single()

  if (tenantErr) {
    console.error('✗ Erro criando tenant:', tenantErr.message)
    process.exit(1)
  }
  console.log(`  ✓ Tenant criado: ${tenant.id}`)

  // 2. business_hours (Seg=1 a Sáb=6 abertos 9-18, Dom=0 fechado)
  if (!args.skipHours) {
    const hours = Array.from({ length: 7 }, (_, weekday) => ({
      tenant_id: tenant.id,
      weekday,
      is_open: weekday !== 0,
      start_time: '09:00:00',
      end_time: '18:00:00',
    }))
    const { error: hoursErr } = await supabase.from('business_hours').insert(hours)
    if (hoursErr) {
      console.error('  ✗ Erro criando business_hours:', hoursErr.message)
      console.error('    Tenant criado mas sem horários — ajuste manual no admin.')
    } else {
      console.log('  ✓ business_hours seedados (Seg-Sáb 9-18, Dom fechado)')
    }
  }

  // 3. Auth user — cria ou reusa
  let userId: string
  const { data: existingUser } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const existing = existingUser?.users.find((u) => u.email === args.ownerEmail)

  if (existing) {
    console.log(`  ↪ Auth user já existe (${existing.id}), reusando.`)
    userId = existing.id
  } else {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: args.ownerEmail,
      email_confirm: true,
      user_metadata: { name: args.ownerName },
    })
    if (createErr || !created.user) {
      console.error('  ✗ Erro criando auth user:', createErr?.message)
      process.exit(1)
    }
    userId = created.user.id
    console.log(`  ✓ Auth user criado: ${userId}`)
  }

  // 4. user_profiles → BUSINESS_OWNER do tenant
  const { error: profileErr } = await supabase.from('user_profiles').insert({
    user_id: userId,
    tenant_id: tenant.id,
    role: 'BUSINESS_OWNER',
    name: args.ownerName,
    is_active: true,
  })
  if (profileErr) {
    console.error('  ✗ Erro criando user_profile:', profileErr.message)
    console.error('    Pode ser que o usuário já tenha profile em outro tenant.')
    process.exit(1)
  }
  console.log('  ✓ user_profile criado com role BUSINESS_OWNER')

  // 5. Reset de senha pro owner definir a própria
  const { error: resetErr } = await supabase.auth.resetPasswordForEmail(args.ownerEmail, {
    redirectTo: `https://${args.subdomain}.aralabs.com.br/admin/reset-password`,
  })
  if (resetErr) {
    console.warn(
      `  ⚠ Reset de senha falhou (${resetErr.message}). Owner precisa usar "Esqueci a senha" em /admin/forgot-password.`,
    )
  } else {
    console.log(`  ✓ Email de reset de senha enviado pra ${args.ownerEmail}`)
  }

  console.log('\n✓ Tenant provisionado com sucesso.')
  console.log(`  Admin: https://${args.subdomain}.aralabs.com.br/admin/login`)
  console.log(`  Cliente: https://${args.subdomain}.aralabs.com.br/`)
  console.log('\nPróximos passos pro owner:')
  console.log('  1. Ler email de reset de senha e definir senha.')
  console.log('  2. Logar e completar setup: serviços, profissionais, branding.')
}

main().catch((e) => {
  console.error('Erro inesperado:', e)
  process.exit(1)
})
