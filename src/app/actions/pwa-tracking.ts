'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/tenant/context'

async function getMyCustomerIdForTenant(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const tenantId = await getCurrentTenantId()
  if (!tenantId) return null
  const { data } = await supabase
    .from('customers')
    .select('id')
    .eq('user_id', user.id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()
  return data?.id ?? null
}

export async function markPwaInstalled() {
  const id = await getMyCustomerIdForTenant()
  if (!id) return { ok: false as const }
  const supabase = await createClient()
  await supabase
    .from('customers')
    .update({ pwa_installed_at: new Date().toISOString() })
    .eq('id', id)
    .is('pwa_installed_at', null)
  return { ok: true as const }
}

export async function markPwaInstallDismissed() {
  const id = await getMyCustomerIdForTenant()
  if (!id) return { ok: false as const }
  const supabase = await createClient()
  await supabase
    .from('customers')
    .update({ pwa_install_dismissed_at: new Date().toISOString() })
    .eq('id', id)
  return { ok: true as const }
}
