/* eslint-disable no-console -- CLI script: console.log é a interface de output. */
/**
 * Script de provisioning de novo tenant. Thin wrapper de CLI em volta
 * do módulo `lib/platform/provision`, que tem a lógica de banco e é
 * reusado pela server action de criar tenant na UI do platform admin.
 *
 * Uso:
 *   node --env-file=.env.local scripts/provision-tenant.ts \
 *     --slug barbearia-do-fulano \
 *     --name "Barbearia do Fulano" \
 *     --owner-email fulano@example.com \
 *     --owner-name "Fulano da Silva" \
 *     [--timezone America/Sao_Paulo] \
 *     [--subdomain barbearia-do-fulano]   # default = slug
 *     [--skip-hours]
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

import { provisionTenant, ProvisionTenantInputSchema } from '../src/lib/platform/provision.ts'

type CliArgs = {
  slug: string
  name: string
  ownerEmail: string
  ownerName: string
  timezone: string
  subdomain: string | undefined
  skipHours: boolean
}

function parseCliArgs(): CliArgs {
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

  return {
    slug: values.slug as string,
    name: values.name as string,
    ownerEmail: values['owner-email'] as string,
    ownerName: values['owner-name'] as string,
    timezone: (values.timezone as string) ?? 'America/Sao_Paulo',
    subdomain: values.subdomain as string | undefined,
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

  const parsed = ProvisionTenantInputSchema.parse({
    slug: args.slug,
    name: args.name,
    ownerEmail: args.ownerEmail,
    ownerName: args.ownerName,
    timezone: args.timezone,
    subdomain: args.subdomain,
    skipHours: args.skipHours,
  })

  console.log(`\n→ Provisioning tenant "${parsed.name}" (${parsed.slug})...`)

  try {
    const result = await provisionTenant(parsed, supabase)
    console.log(`  ✓ Tenant criado: ${result.tenantId}`)
    console.log(`  ✓ Owner: ${result.ownerUserId}`)
    if (result.resetEmailSent) {
      console.log(`  ✓ Email de reset de senha enviado pra ${parsed.ownerEmail}`)
    } else {
      console.warn(
        `  ⚠ Reset de senha falhou. Owner precisa usar "Esqueci a senha" em /admin/forgot-password.`,
      )
    }
    const subdomain = parsed.subdomain ?? parsed.slug
    console.log('\n✓ Tenant provisionado com sucesso.')
    console.log(`  Admin: https://${subdomain}.aralabs.com.br/admin/login`)
    console.log(`  Cliente: https://${subdomain}.aralabs.com.br/`)
    console.log('\nPróximos passos pro owner:')
    console.log('  1. Ler email de reset de senha e definir senha.')
    console.log('  2. Logar e completar setup: serviços, profissionais, branding.')
  } catch (e) {
    console.error('✗ Erro:', e instanceof Error ? e.message : e)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('Erro inesperado:', e)
  process.exit(1)
})
