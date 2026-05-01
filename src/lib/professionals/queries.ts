import 'server-only'

import { unstable_cache } from 'next/cache'
import { createSecretClient } from '@/lib/supabase/secret'
import { cacheTags } from '@/lib/cache/tags'
import type { Database } from '@/lib/supabase/types'

export type Professional = Pick<
  Database['public']['Tables']['professionals']['Row'],
  'id' | 'name' | 'is_active' | 'photo_url' | 'phone' | 'email' | 'display_name'
>

/**
 * Lista profissionais do tenant. **Cacheada** (unstable_cache) — invalida via
 * `cacheTags.professionals(tenantId)` em CRUD de professionals.
 *
 * Caller deve ter feito `assertStaff({ expectedTenantId: tenantId })` antes
 * de chamar (cache scope não pode usar cookies, então auth é page-level).
 */
export async function getProfessionals(tenantId: string): Promise<Professional[]> {
  return unstable_cache(
    async () => {
      const supabase = createSecretClient()
      const { data, error } = await supabase
        .from('professionals')
        .select('id, name, is_active, photo_url, phone, email, display_name')
        .eq('tenant_id', tenantId)
        .order('name')

      if (error) throw error
      return data ?? []
    },
    ['getProfessionals', tenantId],
    { tags: [cacheTags.professionals(tenantId)], revalidate: 86400 },
  )()
}

/**
 * Detalhe de 1 profissional. Invalida via
 * `cacheTags.professional(tenantId, profId)`.
 */
export async function getProfessional(
  tenantId: string,
  profId: string,
): Promise<Database['public']['Tables']['professionals']['Row'] | null> {
  return unstable_cache(
    async () => {
      const supabase = createSecretClient()
      const { data, error } = await supabase
        .from('professionals')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('id', profId)
        .maybeSingle()

      if (error) throw error
      return data
    },
    ['getProfessional', tenantId, profId],
    { tags: [cacheTags.professional(tenantId, profId)], revalidate: 86400 },
  )()
}
