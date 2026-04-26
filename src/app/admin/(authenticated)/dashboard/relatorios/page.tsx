import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createClient } from '@/lib/supabase/server'
import {
  ReportsSummary,
  type ReportAppt,
} from '@/components/dashboard/reports-summary'
import { rangeFromPreset, type RangePreset } from '@/lib/reports/range'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function parsePreset(raw: string | string[] | undefined): RangePreset {
  if (raw === 'today' || raw === 'week' || raw === 'month') return raw
  return 'month'
}

export default async function RelatoriosPage({ searchParams }: PageProps) {
  const tenant = await getCurrentTenantOrNotFound()
  const sp = await searchParams
  const preset = parsePreset(sp.preset)
  const range = rangeFromPreset(preset, tenant.timezone)

  const supabase = await createClient()
  const [apptsRes, servicesRes, profsRes] = await Promise.all([
    supabase
      .from('appointments')
      .select(
        'status, service_id, professional_id, service_name_snapshot',
      )
      .eq('tenant_id', tenant.id)
      .gte('start_at', range.from)
      .lte('start_at', range.to),
    supabase
      .from('services')
      .select('id, name')
      .eq('tenant_id', tenant.id),
    supabase
      .from('professionals')
      .select('id, name, display_name')
      .eq('tenant_id', tenant.id),
  ])

  const appointments: ReportAppt[] = (apptsRes.data ?? []).map((a) => ({
    status: a.status,
    service_id: a.service_id,
    professional_id: a.professional_id,
    service_name_snapshot: a.service_name_snapshot,
  }))

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Análises
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Relatórios
        </h1>
        <p className="mt-1 text-[0.875rem] text-fg-muted">
          Resumo operacional do período.
        </p>
      </header>
      <ReportsSummary
        appointments={appointments}
        services={servicesRes.data ?? []}
        professionals={profsRes.data ?? []}
        currentPreset={preset}
      />
    </main>
  )
}
