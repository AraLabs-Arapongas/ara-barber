import { notFound } from 'next/navigation'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createClient } from '@/lib/supabase/server'
import {
  ProfessionalDetail,
  type DetailAvailability,
  type DetailBlock,
  type DetailPro,
  type DetailService,
} from '@/components/dashboard/professional-detail'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ProfessionalDetailPage({ params }: PageProps) {
  const tenant = await getCurrentTenantOrNotFound()
  const { id } = await params
  const supabase = await createClient()

  const { data: proRow } = await supabase
    .from('professionals')
    .select('id, name, display_name, phone, is_active')
    .eq('tenant_id', tenant.id)
    .eq('id', id)
    .maybeSingle()

  if (!proRow) notFound()

  const [{ data: svcData }, { data: linksData }, { data: availData }, { data: blocksData }] =
    await Promise.all([
      supabase
        .from('services')
        .select('id, name, is_active')
        .eq('tenant_id', tenant.id)
        .order('name'),
      supabase
        .from('professional_services')
        .select('service_id')
        .eq('tenant_id', tenant.id)
        .eq('professional_id', id),
      supabase
        .from('professional_availability')
        .select('weekday, start_time, end_time')
        .eq('tenant_id', tenant.id)
        .eq('professional_id', id),
      supabase
        .from('availability_blocks')
        .select('id, start_at, end_at, reason')
        .eq('tenant_id', tenant.id)
        .eq('professional_id', id)
        .gte('end_at', new Date().toISOString())
        .order('start_at'),
    ])

  const pro: DetailPro = {
    id: proRow.id,
    name: proRow.name,
    displayName: proRow.display_name,
    phone: proRow.phone,
    isActive: proRow.is_active,
  }
  const services: DetailService[] = (svcData ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    isActive: s.is_active,
  }))
  const linkedServiceIds = (linksData ?? []).map((l) => l.service_id)
  const availability: DetailAvailability[] = (availData ?? []).map((a) => ({
    weekday: a.weekday,
    startTime: a.start_time,
    endTime: a.end_time,
  }))
  const blocks: DetailBlock[] = (blocksData ?? []).map((b) => ({
    id: b.id,
    startAt: b.start_at,
    endAt: b.end_at,
    reason: b.reason,
  }))

  return (
    <ProfessionalDetail
      pro={pro}
      services={services}
      linkedServiceIds={linkedServiceIds}
      availability={availability}
      blocks={blocks}
    />
  )
}
