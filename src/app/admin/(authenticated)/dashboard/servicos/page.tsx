import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createClient } from '@/lib/supabase/server'
import {
  ServicesManager,
  type ServiceListItem,
  type ServiceProfessional,
} from '@/components/dashboard/services-manager'

export default async function ServicesPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const supabase = await createClient()

  const [servicesRes, profServicesRes, profsRes] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, description, duration_minutes, price_cents, is_active')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('professional_services')
      .select('professional_id, service_id')
      .eq('tenant_id', tenant.id),
    supabase
      .from('professionals')
      .select('id, name, display_name')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('name'),
  ])

  const profById = new Map((profsRes.data ?? []).map((p) => [p.id, p.display_name ?? p.name]))

  const namesByService = new Map<string, string[]>()
  const idsByService = new Map<string, string[]>()
  for (const ps of profServicesRes.data ?? []) {
    const name = profById.get(ps.professional_id)
    if (!name) continue
    const names = namesByService.get(ps.service_id) ?? []
    names.push(name)
    namesByService.set(ps.service_id, names)
    const ids = idsByService.get(ps.service_id) ?? []
    ids.push(ps.professional_id)
    idsByService.set(ps.service_id, ids)
  }

  const services: ServiceListItem[] = (servicesRes.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    durationMinutes: s.duration_minutes,
    priceCents: s.price_cents,
    isActive: s.is_active,
    professionalNames: namesByService.get(s.id) ?? [],
    professionalIds: idsByService.get(s.id) ?? [],
  }))

  const professionals: ServiceProfessional[] = (profsRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.display_name ?? p.name,
  }))

  return <ServicesManager services={services} professionals={professionals} />
}
