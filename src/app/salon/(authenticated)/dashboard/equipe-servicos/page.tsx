import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createClient } from '@/lib/supabase/server'
import { TeamServicesMatrix } from '@/components/dashboard/team-services-matrix'

export default async function EquipeServicosPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const supabase = await createClient()

  const [{ data: prosData }, { data: svcData }, { data: linksData }] = await Promise.all([
    supabase
      .from('professionals')
      .select('id, name, display_name')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('services')
      .select('id, name, is_active')
      .eq('tenant_id', tenant.id)
      .order('name'),
    supabase
      .from('professional_services')
      .select('professional_id, service_id')
      .eq('tenant_id', tenant.id),
  ])

  const professionals = (prosData ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    displayName: p.display_name,
  }))

  const services = (svcData ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    isActive: s.is_active,
  }))

  const links = (linksData ?? []).map((l) => ({
    professionalId: l.professional_id,
    serviceId: l.service_id,
  }))

  return (
    <>
      <div className="mx-auto w-full max-w-2xl px-5 pt-8 sm:px-8">
        <Link
          href="/salon/dashboard/mais"
          className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] text-fg-muted hover:text-fg"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Voltar
        </Link>
      </div>
      <TeamServicesMatrix
        professionals={professionals}
        services={services}
        links={links}
      />
    </>
  )
}
