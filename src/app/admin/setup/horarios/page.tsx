import { redirect } from 'next/navigation'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { getOnboardingState } from '@/lib/onboarding/queries'
import { ProgressIndicator } from '../_components/progress-indicator'
import { HoursForm } from './form'
import { createSecretClient } from '@/lib/supabase/secret'

export default async function HoursStepPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const state = await getOnboardingState(tenant.id)
  if (state.stage1.completed) redirect('/admin/dashboard')

  const supabase = createSecretClient()
  const { data: existing } = await supabase
    .from('business_hours')
    .select('weekday, is_open, start_time, end_time')
    .eq('tenant_id', tenant.id)
    .order('weekday')

  const days = Array.from({ length: 7 }, (_, weekday) => {
    const found = existing?.find((e) => e.weekday === weekday)
    if (found) {
      return {
        weekday,
        is_open: found.is_open,
        start_time: found.start_time.slice(0, 5),
        end_time: found.end_time.slice(0, 5),
      }
    }
    return {
      weekday,
      is_open: weekday !== 0,
      start_time: '09:00',
      end_time: '18:00',
    }
  })

  return (
    <>
      <ProgressIndicator stage={1} stepInStage={1} stepTitle="Horários de funcionamento" />
      <p className="mb-6 text-[0.875rem] text-fg-muted">
        Quando seu negócio fica aberto? Você pode ajustar depois em{' '}
        <span className="text-fg">Mais → Disponibilidade</span>.
      </p>
      <HoursForm initialDays={days} />
    </>
  )
}
