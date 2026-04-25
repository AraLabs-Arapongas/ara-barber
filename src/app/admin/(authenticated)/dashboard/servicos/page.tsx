import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createClient } from '@/lib/supabase/server'
import {
  ServicesManager,
  type ServiceListItem,
} from '@/components/dashboard/services-manager'

export default async function ServicesPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const supabase = await createClient()
  const { data } = await supabase
    .from('services')
    .select('id, name, description, duration_minutes, price_cents, is_active')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: true })

  const services: ServiceListItem[] = (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    durationMinutes: s.duration_minutes,
    priceCents: s.price_cents,
    isActive: s.is_active,
  }))

  return <ServicesManager services={services} />
}
