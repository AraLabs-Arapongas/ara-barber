import { redirect } from 'next/navigation'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { getOnboardingState } from '@/lib/onboarding/queries'
import { ProgressIndicator } from '../_components/progress-indicator'
import { BrandStepForm } from './form'
import { createSecretClient } from '@/lib/supabase/secret'

export default async function BrandStepPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const state = await getOnboardingState(tenant.id)
  if (!state.stage1.completed) redirect('/admin/setup')
  if (state.stage2.completed) redirect('/admin/setup')

  const supabase = createSecretClient()
  const { data } = await supabase
    .from('tenants')
    .select('primary_color, accent_color, logo_url')
    .eq('id', tenant.id)
    .maybeSingle()

  return (
    <>
      <ProgressIndicator stage={2} stepInStage={1} stepTitle="Cores e logo" />
      <p className="mb-6 text-[0.875rem] text-fg-muted">
        Defina a identidade visual mínima — você pode refinar depois em{' '}
        <span className="text-fg">Mais → Marca e aparência</span>.
      </p>
      <BrandStepForm
        initial={{
          primary_color: data?.primary_color ?? '#17343f',
          accent_color: data?.accent_color ?? '',
          logo_url: data?.logo_url ?? '',
        }}
      />
    </>
  )
}
