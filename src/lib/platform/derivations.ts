import type { Database } from '@/lib/supabase/types'

export type TenantDerivationRow = {
  id: string
  status: Database['public']['Enums']['tenant_status']
  billing_status: Database['public']['Enums']['billing_status']
  monthly_price_cents: number | null
  trial_ends_at: string | null
}

export function calculateMRR(tenants: ReadonlyArray<TenantDerivationRow>): number {
  return tenants
    .filter((t) => t.billing_status === 'ACTIVE')
    .reduce((sum, t) => sum + (t.monthly_price_cents ?? 0), 0)
}

export function countByStatus(
  tenants: ReadonlyArray<TenantDerivationRow>,
): Record<Database['public']['Enums']['tenant_status'], number> {
  const init = { ACTIVE: 0, SUSPENDED: 0, ARCHIVED: 0 } as Record<
    Database['public']['Enums']['tenant_status'],
    number
  >
  for (const t of tenants) init[t.status] = (init[t.status] ?? 0) + 1
  return init
}

export function filterTrialsExpiringWithinDays<T extends TenantDerivationRow>(
  tenants: ReadonlyArray<T>,
  days: number,
  reference: Date = new Date(),
): T[] {
  const refMs = reference.getTime()
  const horizonMs = refMs + days * 24 * 60 * 60 * 1000
  return tenants.filter((t) => {
    if (t.billing_status !== 'TRIALING' || !t.trial_ends_at) return false
    const expiresMs = new Date(t.trial_ends_at).getTime()
    return expiresMs <= horizonMs
  })
}
