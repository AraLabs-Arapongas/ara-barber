import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { createSecretClient } from '@/lib/supabase/secret'

export type EnsuredCustomer = {
  id: string
  tenantId: string
  userId: string
  name: string | null
  phone: string | null
  email: string | null
}

/**
 * Garante que o auth.user atual tenha uma linha em `customers` para o tenant.
 * Se não existir, insere usando email/nome do auth.users. Retorna a linha.
 * Retorna null se não houver usuário autenticado.
 *
 * Staff (BUSINESS_OWNER/RECEPTIONIST/PROFESSIONAL/PLATFORM_ADMIN) nunca vira customer:
 * retorna null e o chamador precisa redirecionar pra outra tela.
 */
const STAFF_ROLES = new Set([
  'PLATFORM_ADMIN',
  'BUSINESS_OWNER',
  'RECEPTIONIST',
  'PROFESSIONAL',
])

export async function ensureCustomerForTenant(
  tenantId: string,
): Promise<EnsuredCustomer | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (profile && STAFF_ROLES.has(profile.role)) return null

  const { data: existing } = await supabase
    .from('customers')
    .select('id, tenant_id, user_id, name, phone, email')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    return {
      id: existing.id,
      tenantId: existing.tenant_id,
      userId: existing.user_id,
      name: existing.name,
      phone: existing.phone,
      email: existing.email,
    }
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const fullName =
    typeof meta.full_name === 'string'
      ? meta.full_name
      : typeof meta.name === 'string'
        ? meta.name
        : null

  // Usa secret client pra inserir — bypassa a unique constraint race-condition
  // e evita depender de current_tenant_id() (que não existe pra customer).
  const admin = createSecretClient()
  const { data: inserted, error } = await admin
    .from('customers')
    .insert({
      tenant_id: tenantId,
      user_id: user.id,
      email: user.email ?? null,
      name: fullName,
      consent_given_at: new Date().toISOString(),
    })
    .select('id, tenant_id, user_id, name, phone, email')
    .single()

  if (error || !inserted) return null
  return {
    id: inserted.id,
    tenantId: inserted.tenant_id,
    userId: inserted.user_id,
    name: inserted.name,
    phone: inserted.phone,
    email: inserted.email,
  }
}

export async function getCustomerForTenant(
  tenantId: string,
): Promise<EnsuredCustomer | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('customers')
    .select('id, tenant_id, user_id, name, phone, email')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!data) return null
  return {
    id: data.id,
    tenantId: data.tenant_id,
    userId: data.user_id,
    name: data.name,
    phone: data.phone,
    email: data.email,
  }
}

/**
 * Atualiza name/phone da customer row (usado no step de confirmar).
 * RLS: policy customers_self_update permite.
 */
export async function updateMyCustomerProfile(
  customerId: string,
  fields: { name?: string; phone?: string },
): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('customers')
    .update({
      ...(fields.name !== undefined ? { name: fields.name } : {}),
      ...(fields.phone !== undefined ? { phone: fields.phone } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', customerId)
}
