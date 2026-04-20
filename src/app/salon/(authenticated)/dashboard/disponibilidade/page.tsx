import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createClient } from '@/lib/supabase/server'
import {
  AvailabilityManager,
  type AvailabilityBlock,
  type AvailabilityEntry,
  type ProfessionalLite,
} from '@/components/dashboard/availability-manager'

export default async function DisponibilidadePage() {
  const tenant = await getCurrentTenantOrNotFound()
  const supabase = await createClient()

  const [{ data: prosData }, { data: availData }, { data: blocksData }] =
    await Promise.all([
      supabase
        .from('professionals')
        .select('id, name, display_name')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('professional_availability')
        .select('id, professional_id, weekday, start_time, end_time')
        .eq('tenant_id', tenant.id),
      supabase
        .from('availability_blocks')
        .select('id, professional_id, start_at, end_at, reason')
        .eq('tenant_id', tenant.id)
        .gte('end_at', new Date().toISOString())
        .order('start_at'),
    ])

  const professionals: ProfessionalLite[] = (prosData ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    displayName: p.display_name,
  }))

  const availability: AvailabilityEntry[] = (availData ?? []).map((a) => ({
    id: a.id,
    professionalId: a.professional_id,
    weekday: a.weekday,
    startTime: a.start_time,
    endTime: a.end_time,
  }))

  const blocks: AvailabilityBlock[] = (blocksData ?? []).map((b) => ({
    id: b.id,
    professionalId: b.professional_id,
    startAt: b.start_at,
    endAt: b.end_at,
    reason: b.reason,
  }))

  return (
    <AvailabilityManager
      professionals={professionals}
      availability={availability}
      blocks={blocks}
    />
  )
}
