import { redirect } from 'next/navigation'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { getOnboardingState } from '@/lib/onboarding/queries'
import { nextStepPath } from '@/lib/onboarding/derivations'

export default async function SetupEntryPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const state = await getOnboardingState(tenant.id)
  redirect(nextStepPath(state))
}
