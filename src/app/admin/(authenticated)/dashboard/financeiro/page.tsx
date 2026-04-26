import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createClient } from '@/lib/supabase/server'
import { FinancialSummary, type FinAppt } from '@/components/dashboard/financial-summary'
import { MoneyVisibilityToggle } from '@/components/ui/money-visibility-toggle'
import { rangeFromPreset, type RangePreset } from '@/lib/reports/range'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function parsePreset(raw: string | string[] | undefined): RangePreset {
  if (raw === 'week' || raw === 'month' || raw === 'today') return raw
  return 'today'
}

export default async function FinanceiroPage({ searchParams }: PageProps) {
  const tenant = await getCurrentTenantOrNotFound()
  const sp = await searchParams
  const preset = parsePreset(sp.preset)
  const range = rangeFromPreset(preset, tenant.timezone)

  const supabase = await createClient()
  const [apptsRes, servicesRes, profsRes] = await Promise.all([
    supabase
      .from('appointments')
      .select(
        'id, status, start_at, price_cents_snapshot, service_id, professional_id, service_name_snapshot, customer_name_snapshot',
      )
      .eq('tenant_id', tenant.id)
      .gte('start_at', range.from)
      .lte('start_at', range.to)
      .order('start_at', { ascending: false }),
    supabase.from('services').select('id, name, price_cents').eq('tenant_id', tenant.id),
    supabase.from('professionals').select('id, name, display_name').eq('tenant_id', tenant.id),
  ])

  const appointments: FinAppt[] = (apptsRes.data ?? []).map((a) => ({
    id: a.id,
    status: a.status,
    start_at: a.start_at,
    price_cents_snapshot: a.price_cents_snapshot,
    service_id: a.service_id,
    professional_id: a.professional_id,
    service_name_snapshot: a.service_name_snapshot,
    customer_name_snapshot: a.customer_name_snapshot,
  }))

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
            Gestão
          </p>
          <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
            Financeiro
          </h1>
          <p className="mt-1 text-[0.875rem] text-fg-muted">
            Resumo dos valores baseado em agendamentos e status.{' '}
            <span className="text-fg-subtle">
              Não representa pagamento real — pagamento online entra em fase futura.
            </span>
          </p>
        </div>
        <MoneyVisibilityToggle className="mt-1" />
      </header>
      <FinancialSummary
        appointments={appointments}
        services={servicesRes.data ?? []}
        professionals={profsRes.data ?? []}
        currentPreset={preset}
        tenantTimezone={tenant.timezone}
      />
    </main>
  )
}
