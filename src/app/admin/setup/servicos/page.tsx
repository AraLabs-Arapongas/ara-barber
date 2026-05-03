import { redirect } from 'next/navigation'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { getOnboardingState } from '@/lib/onboarding/queries'
import { ProgressIndicator } from '../_components/progress-indicator'
import { ServicesForm } from './form'
import { createSecretClient } from '@/lib/supabase/secret'

export default async function ServicesStepPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const state = await getOnboardingState(tenant.id)
  if (state.stage1.completed) redirect('/admin/dashboard')

  const supabase = createSecretClient()
  const { data: existing } = await supabase
    .from('services')
    .select('name, duration_minutes, price_cents')
    .eq('tenant_id', tenant.id)
    .order('name')
  const initial = existing && existing.length > 0
    ? existing.map((s) => ({
        name: s.name,
        duration_minutes: s.duration_minutes,
        price_cents: s.price_cents,
      }))
    : [{ name: '', duration_minutes: 30, price_cents: 0 }]

  return (
    <>
      <ProgressIndicator stage={1} stepInStage={2} stepTitle="Serviços" />
      <p className="mb-6 text-[0.875rem] text-fg-muted">
        O que seu negócio oferece? Você pode adicionar mais depois em{' '}
        <span className="text-fg">Mais → Serviços</span>.
      </p>
      <ServicesForm initial={initial} />
    </>
  )
}
