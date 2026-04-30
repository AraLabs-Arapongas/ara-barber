import 'server-only'
import { assertPlatformAdmin } from '@/lib/auth/guards'
import { createSecretClient } from '@/lib/supabase/secret'
import type { Database } from '@/lib/supabase/types'

export type AdminTenantRow = Pick<
  Database['public']['Tables']['tenants']['Row'],
  | 'id'
  | 'slug'
  | 'name'
  | 'subdomain'
  | 'status'
  | 'billing_status'
  | 'current_plan_id'
  | 'monthly_price_cents'
  | 'trial_ends_at'
  | 'created_at'
  | 'primary_color'
  | 'secondary_color'
  | 'accent_color'
  | 'logo_url'
  | 'favicon_url'
>

const TENANT_COLUMNS =
  'id, slug, name, subdomain, status, billing_status, current_plan_id, monthly_price_cents, trial_ends_at, created_at, primary_color, secondary_color, accent_color, logo_url, favicon_url'

export async function listAllTenants(): Promise<AdminTenantRow[]> {
  await assertPlatformAdmin()
  const supabase = createSecretClient()
  const { data, error } = await supabase
    .from('tenants')
    .select(TENANT_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function getTenantById(id: string): Promise<AdminTenantRow | null> {
  await assertPlatformAdmin()
  const supabase = createSecretClient()
  const { data, error } = await supabase
    .from('tenants')
    .select(TENANT_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data
}
