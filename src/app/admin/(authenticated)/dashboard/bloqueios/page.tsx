import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createClient } from '@/lib/supabase/server'
import { BlocksManager } from '@/components/dashboard/blocks-manager'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function BloqueiosPage({ searchParams }: PageProps) {
  const tenant = await getCurrentTenantOrNotFound()
  const sp = await searchParams
  const initialNew = sp.new === '1'
  const initialProfessional =
    typeof sp.professional === 'string' && /^[0-9a-f-]{36}$/i.test(sp.professional)
      ? sp.professional
      : null

  const supabase = await createClient()
  const [blocksRes, profsRes] = await Promise.all([
    supabase
      .from('availability_blocks')
      .select('id, professional_id, start_at, end_at, reason')
      .eq('tenant_id', tenant.id)
      .gte('end_at', new Date().toISOString())
      .order('start_at'),
    supabase
      .from('professionals')
      .select('id, name, display_name')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('name'),
  ])

  const blocks = (blocksRes.data ?? []).map((b) => ({
    id: b.id,
    professionalId: b.professional_id,
    startAt: b.start_at,
    endAt: b.end_at,
    reason: b.reason,
  }))

  const professionals = (profsRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.display_name ?? p.name,
  }))

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Agenda
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Bloqueios, folgas e feriados
        </h1>
        <p className="mt-1 text-[0.875rem] text-fg-muted">
          Bloqueie horários do negócio inteiro ou de um profissional específico.
        </p>
      </header>
      <BlocksManager
        blocks={blocks}
        professionals={professionals}
        tenantTimezone={tenant.timezone}
        initialNew={initialNew}
        initialProfessional={initialProfessional}
      />
    </main>
  )
}
