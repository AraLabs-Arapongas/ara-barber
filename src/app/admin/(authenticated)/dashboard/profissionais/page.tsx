import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createClient } from '@/lib/supabase/server'
import {
  ProfessionalsManager,
  type ProfessionalListItem,
} from '@/components/dashboard/professionals-manager'

export default async function ProfessionalsPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const supabase = await createClient()
  const { data } = await supabase
    .from('professionals')
    .select('id, name, display_name, phone, is_active')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: true })

  const professionals: ProfessionalListItem[] = (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    displayName: p.display_name,
    phone: p.phone,
    isActive: p.is_active,
  }))

  return <ProfessionalsManager professionals={professionals} />
}
