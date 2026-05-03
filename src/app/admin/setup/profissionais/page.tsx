import { redirect } from 'next/navigation'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { getOnboardingState } from '@/lib/onboarding/queries'
import { ProgressIndicator } from '../_components/progress-indicator'
import { ProfessionalsForm } from './form'
import { createSecretClient } from '@/lib/supabase/secret'

export default async function ProfessionalsStepPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const state = await getOnboardingState(tenant.id)
  if (state.stage1.completed) redirect('/admin/dashboard')

  const supabase = createSecretClient()
  const { data: existing } = await supabase
    .from('professionals')
    .select('name')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('name')
  const initial = existing && existing.length > 0
    ? existing.map((p) => ({ name: p.name }))
    : [{ name: '' }]

  return (
    <>
      <ProgressIndicator stage={1} stepInStage={3} stepTitle="Profissionais" />
      <p className="mb-6 text-[0.875rem] text-fg-muted">
        Quem atende? Pode adicionar mais depois em{' '}
        <span className="text-fg">Mais → Profissionais</span>.
      </p>
      <ProfessionalsForm initial={initial} />
    </>
  )
}
