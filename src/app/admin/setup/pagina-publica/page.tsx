import { redirect } from 'next/navigation'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { getOnboardingState } from '@/lib/onboarding/queries'
import { ProgressIndicator } from '../_components/progress-indicator'
import { LandingStepForm } from './form'
import { createSecretClient } from '@/lib/supabase/secret'

const ALL_BLOCKS = [
  { type: 'HERO', label: 'Hero (banner principal)', defaultEnabled: true },
  { type: 'SERVICES', label: 'Serviços', defaultEnabled: true },
  { type: 'DIFFERENTIALS', label: 'Diferenciais', defaultEnabled: true },
  { type: 'PROFESSIONALS', label: 'Profissionais', defaultEnabled: true },
  { type: 'TESTIMONIALS', label: 'Depoimentos', defaultEnabled: false },
  { type: 'CONTACT', label: 'Contato', defaultEnabled: true },
  { type: 'FINAL_CTA', label: 'CTA final', defaultEnabled: true },
] as const

export default async function LandingStepPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const state = await getOnboardingState(tenant.id)
  if (!state.stage1.completed) redirect('/admin/setup')
  if (state.stage2.completed) redirect('/admin/setup')

  const supabase = createSecretClient()
  const { data: existing } = await supabase
    .from('landing_blocks')
    .select('block_type, enabled')
    .eq('tenant_id', tenant.id)

  const enabledMap = new Map((existing ?? []).map((b) => [b.block_type, b.enabled]))
  const initialEnabled = ALL_BLOCKS.filter((b) =>
    enabledMap.has(b.type) ? enabledMap.get(b.type) : b.defaultEnabled,
  ).map((b) => b.type)

  return (
    <>
      <ProgressIndicator stage={2} stepInStage={2} stepTitle="Página pública" />
      <p className="mb-6 text-[0.875rem] text-fg-muted">
        Escolha quais seções aparecem na sua página. Você ajusta os textos depois em{' '}
        <span className="text-fg">Mais → Página pública</span>.
      </p>
      <LandingStepForm
        blocks={ALL_BLOCKS.map((b) => ({ ...b }))}
        initialEnabled={initialEnabled}
      />
    </>
  )
}
