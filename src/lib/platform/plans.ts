import 'server-only'

import { assertPlatformAdmin } from '@/lib/auth/guards'
import { createSecretClient } from '@/lib/supabase/secret'
import type { Database } from '@/lib/supabase/types'

export type AdminPlanRow = Database['public']['Tables']['plans']['Row']

export async function listPlans(): Promise<AdminPlanRow[]> {
  await assertPlatformAdmin()
  const supabase = createSecretClient()
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .order('monthly_price_cents', { ascending: true })
  if (error) throw error
  return data ?? []
}
