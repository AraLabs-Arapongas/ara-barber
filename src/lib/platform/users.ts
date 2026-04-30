import 'server-only'
import { createSecretClient } from '@/lib/supabase/secret'
import type { Database } from '@/lib/supabase/types'

export type AdminUserRow = {
  id: string
  user_id: string
  name: string
  role: Database['public']['Enums']['user_role']
  is_active: boolean
  tenant_id: string | null
  tenant_name: string | null
  email: string | null
  last_sign_in_at: string | null
}

export async function listAllUsers(): Promise<AdminUserRow[]> {
  const supabase = createSecretClient()
  const [{ data: profiles, error: profErr }, { data: authData }] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('id, user_id, name, role, is_active, tenant_id, tenants(name)')
      .order('name'),
    supabase.auth.admin.listUsers({ perPage: 1000 }),
  ])
  if (profErr) throw profErr
  const authMap = new Map((authData?.users ?? []).map((u) => [u.id, u]))
  return (profiles ?? []).map((p) => {
    const auth = authMap.get(p.user_id)
    const tenants = p.tenants as { name: string } | { name: string }[] | null
    const tenantName = Array.isArray(tenants) ? (tenants[0]?.name ?? null) : (tenants?.name ?? null)
    return {
      id: p.id,
      user_id: p.user_id,
      name: p.name,
      role: p.role,
      is_active: p.is_active,
      tenant_id: p.tenant_id,
      tenant_name: tenantName,
      email: auth?.email ?? null,
      last_sign_in_at: auth?.last_sign_in_at ?? null,
    }
  })
}
