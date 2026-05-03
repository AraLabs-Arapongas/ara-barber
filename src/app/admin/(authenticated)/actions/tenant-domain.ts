'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assertStaff, AuthError } from '@/lib/auth/guards'
import { createSecretClient } from '@/lib/supabase/secret'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import {
  addDomainToProject,
  getDomainStatus,
  removeDomainFromProject,
  type DomainStatus,
} from '@/lib/vercel/domains'

// Hostname FQDN: ao menos 2 labels, cada label 1-63 chars, sem schema/path/porta.
// Não tenta validar TLD — registrar do user pode ter TLD novo.
const HOSTNAME_REGEX = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

const RESERVED_SUFFIXES = ['aralabs.com.br', 'lvh.me', 'vercel.app', 'vercel.sh']

const SetDomainInput = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .min(4)
    .max(253)
    .regex(HOSTNAME_REGEX, 'Domínio inválido. Use formato `agendar.seusite.com.br`.'),
})

export type SetCustomDomainResult =
  | { ok: true; status: DomainStatus }
  | { ok: false; error: string }

async function assertOwner() {
  const user = await assertStaff()
  if (user.profile.role !== 'BUSINESS_OWNER') {
    throw new AuthError('FORBIDDEN', 'Apenas o dono pode mexer em domínio próprio.')
  }
  return user
}

/**
 * Cadastra ou troca o custom domain do tenant atual. Anexa na Vercel
 * (cert auto via Let's Encrypt) e persiste na DB. Retorna o status
 * inicial (geralmente verified=false até DNS propagar).
 *
 * Se já existia outro domínio cadastrado, ele é removido da Vercel
 * antes (evita acumular cert pendente).
 */
export async function setCustomDomain(raw: { domain: string }): Promise<SetCustomDomainResult> {
  let user
  try {
    user = await assertOwner()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
  }

  const parsed = SetDomainInput.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Domínio inválido.' }
  }
  const { domain } = parsed.data

  if (RESERVED_SUFFIXES.some((s) => domain === s || domain.endsWith(`.${s}`))) {
    return { ok: false, error: 'Use um domínio próprio (não aralabs.com.br nem vercel.app).' }
  }

  const tenant = await getCurrentTenantOrNotFound()
  if (tenant.id !== user.profile.tenantId) {
    return { ok: false, error: 'Tenant não bate com sessão.' }
  }

  // Verifica se outro tenant já usa esse domínio.
  const supabase = createSecretClient()
  const { data: existing } = await supabase
    .from('tenants')
    .select('id, slug')
    .eq('custom_domain', domain)
    .maybeSingle()
  if (existing && existing.id !== tenant.id) {
    return { ok: false, error: 'Esse domínio já está em uso por outro estabelecimento.' }
  }

  // Lê domínio atual pra remover da Vercel se for diferente.
  const { data: tenantRow } = await supabase
    .from('tenants')
    .select('custom_domain')
    .eq('id', tenant.id)
    .single()
  const previous = tenantRow?.custom_domain
  if (previous && previous !== domain) {
    await removeDomainFromProject(previous)
  }

  const addResult = await addDomainToProject(domain)
  if (!addResult.ok) {
    return {
      ok: false,
      error:
        addResult.error === 'domain_already_in_use'
          ? 'Esse domínio já está atribuído a outro projeto na Vercel. Remova lá primeiro.'
          : addResult.error === 'VERCEL_ENV_MISSING'
            ? 'Integração Vercel não configurada. Contate o suporte.'
            : addResult.message,
    }
  }

  const { error: updateErr } = await supabase
    .from('tenants')
    .update({ custom_domain: domain })
    .eq('id', tenant.id)
  if (updateErr) {
    // Rollback Vercel pra não deixar órfão.
    await removeDomainFromProject(domain)
    return { ok: false, error: 'Erro ao salvar. Tente de novo.' }
  }

  const status = await getDomainStatus(domain)
  revalidatePath('/admin/dashboard/dominio')

  return {
    ok: true,
    status: status.ok
      ? status.data
      : { verified: false, configurationOk: false, instructions: [] },
  }
}

export type RemoveCustomDomainResult = { ok: true } | { ok: false; error: string }

export async function removeCustomDomain(): Promise<RemoveCustomDomainResult> {
  let user
  try {
    user = await assertOwner()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
  }

  const tenant = await getCurrentTenantOrNotFound()
  if (tenant.id !== user.profile.tenantId) {
    return { ok: false, error: 'Tenant não bate com sessão.' }
  }

  const supabase = createSecretClient()
  const { data: tenantRow } = await supabase
    .from('tenants')
    .select('custom_domain')
    .eq('id', tenant.id)
    .single()
  const current = tenantRow?.custom_domain
  if (!current) return { ok: true }

  await removeDomainFromProject(current)

  const { error: updateErr } = await supabase
    .from('tenants')
    .update({ custom_domain: null })
    .eq('id', tenant.id)
  if (updateErr) return { ok: false, error: 'Erro ao remover. Tente de novo.' }

  revalidatePath('/admin/dashboard/dominio')
  return { ok: true }
}

export type CheckCustomDomainStatusResult =
  | { ok: true; domain: string | null; status: DomainStatus | null }
  | { ok: false; error: string }

export async function checkCustomDomainStatus(): Promise<CheckCustomDomainStatusResult> {
  try {
    await assertOwner()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
  }

  const tenant = await getCurrentTenantOrNotFound()
  const supabase = createSecretClient()
  const { data: tenantRow } = await supabase
    .from('tenants')
    .select('custom_domain')
    .eq('id', tenant.id)
    .single()
  const domain = tenantRow?.custom_domain ?? null
  if (!domain) return { ok: true, domain: null, status: null }

  const status = await getDomainStatus(domain)
  if (!status.ok) {
    return {
      ok: true,
      domain,
      status: { verified: false, configurationOk: false, instructions: [] },
    }
  }
  return { ok: true, domain, status: status.data }
}
