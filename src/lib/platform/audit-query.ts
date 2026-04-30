import 'server-only'
import { createSecretClient } from '@/lib/supabase/secret'
import type { Database } from '@/lib/supabase/types'

export type AuditEntry = Database['public']['Tables']['audit_log']['Row'] & {
  actor_email: string | null
  tenant_name: string | null
}

export async function listRecentAudit(limit = 100): Promise<AuditEntry[]> {
  const supabase = createSecretClient()
  const { data, error } = await supabase
    .from('audit_log')
    .select('*, tenants(name)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  type RowWithTenant = Database['public']['Tables']['audit_log']['Row'] & {
    tenants: { name: string } | { name: string }[] | null
  }
  const rows = (data ?? []) as RowWithTenant[]
  if (rows.length === 0) return []

  const userIds = Array.from(
    new Set(rows.map((r) => r.actor_user_id).filter((x): x is string => !!x)),
  )
  const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const emailMap = new Map(
    (authData?.users ?? [])
      .filter((u) => userIds.includes(u.id))
      .map((u) => [u.id, u.email ?? null]),
  )

  return rows.map((r) => {
    const tenants = r.tenants
    const tenantName = Array.isArray(tenants) ? (tenants[0]?.name ?? null) : (tenants?.name ?? null)
    return {
      ...r,
      tenants: undefined as never,
      actor_email: r.actor_user_id ? (emailMap.get(r.actor_user_id) ?? null) : null,
      tenant_name: tenantName,
    } as AuditEntry
  })
}
