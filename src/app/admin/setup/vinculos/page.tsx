import { redirect } from 'next/navigation'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { getOnboardingState } from '@/lib/onboarding/queries'
import { ProgressIndicator } from '../_components/progress-indicator'
import { LinksForm } from './form'
import { createSecretClient } from '@/lib/supabase/secret'

export default async function LinksStepPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const state = await getOnboardingState(tenant.id)
  if (state.completed) redirect('/admin/dashboard')

  const supabase = createSecretClient()
  const [{ data: services }, { data: pros }, { data: existingLinks }] = await Promise.all([
    supabase.from('services').select('id, name').eq('tenant_id', tenant.id).order('name'),
    supabase
      .from('professionals')
      .select('id, name')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('professional_services')
      .select('service_id, professional_id')
      .eq('tenant_id', tenant.id),
  ])

  if (!services || services.length === 0) redirect('/admin/setup/servicos')
  if (!pros || pros.length === 0) redirect('/admin/setup/profissionais')

  return (
    <>
      <ProgressIndicator current={4} />
      <p className="mb-6 text-[0.875rem] text-fg-muted">
        Marque quem atende cada serviço. Por padrão, todos atendem tudo.
      </p>
      <LinksForm
        services={services}
        professionals={pros}
        existingLinks={existingLinks ?? []}
      />
    </>
  )
}
