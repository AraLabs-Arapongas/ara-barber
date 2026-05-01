import 'server-only'

import { unstable_cache } from 'next/cache'
import { createSecretClient } from '@/lib/supabase/secret'
import { cacheTags } from '@/lib/cache/tags'
import type { Database } from '@/lib/supabase/types'

export type Service = Pick<
  Database['public']['Tables']['services']['Row'],
  'id' | 'name' | 'description' | 'duration_minutes' | 'price_cents' | 'is_active'
>

/**
 * Lista serviços do tenant. **Cacheada** (unstable_cache) — invalida via
 * `cacheTags.services(tenantId)` em CRUD de services.
 */
export async function getServices(tenantId: string): Promise<Service[]> {
  return unstable_cache(
    async () => {
      const supabase = createSecretClient()
      const { data, error } = await supabase
        .from('services')
        .select('id, name, description, duration_minutes, price_cents, is_active')
        .eq('tenant_id', tenantId)
        .order('name')

      if (error) throw error
      return data ?? []
    },
    ['getServices', tenantId],
    { tags: [cacheTags.services(tenantId)], revalidate: 86400 },
  )()
}

/**
 * Detalhe de 1 serviço. Invalida via `cacheTags.service(tenantId, serviceId)`.
 */
export async function getService(
  tenantId: string,
  serviceId: string,
): Promise<Database['public']['Tables']['services']['Row'] | null> {
  return unstable_cache(
    async () => {
      const supabase = createSecretClient()
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('id', serviceId)
        .maybeSingle()

      if (error) throw error
      return data
    },
    ['getService', tenantId, serviceId],
    { tags: [cacheTags.service(tenantId, serviceId)], revalidate: 86400 },
  )()
}
