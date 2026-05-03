import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getSessionUser } from '@/lib/auth/session'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { ThemeInjector } from '@/components/branding/theme-injector'
import { assertStaff, AuthError } from '@/lib/auth/guards'
import { BottomTabNav } from '@/components/nav/bottom-tab-nav'
import { GlobalFab } from '@/components/nav/global-fab'
import { SwipeNavigator } from '@/components/dashboard/swipe-navigator'
import { OnboardingBanner } from '@/components/dashboard/onboarding-banner'
import { getOnboardingState } from '@/lib/onboarding/queries'
import { createSecretClient } from '@/lib/supabase/secret'

/** Lê só o `onboarding_step` (sem chamar getOnboardingState de novo). */
async function fetchOnboardingStep(tenantId: string): Promise<string | null> {
  const supabase = createSecretClient()
  const { data } = await supabase
    .from('tenants')
    .select('onboarding_step')
    .eq('id', tenantId)
    .maybeSingle()
  return data?.onboarding_step ?? null
}

export default async function AdminAuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  if (!user) redirect('/admin/login')

  const tenant = await getCurrentTenantOrNotFound()

  try {
    await assertStaff({ expectedTenantId: tenant.id })
  } catch (err) {
    if (err instanceof AuthError) redirect('/admin/login')
    throw err
  }

  // Gate: tenant não completou onboarding e não dispensou o wizard → manda
  // pro setup. Owner novo (step IS NULL) NÃO é redirecionado — vê primeiro
  // o welcome modal na home e escolhe entre tour/explorar. Step='tour' E
  // sem cookie → redireciona. Step='skipped' E cookie='1' → fica livre,
  // banner persistente segue mostrando o progresso.
  const onboarding = await getOnboardingState(tenant.id)
  if (!onboarding.completed) {
    const cookieStore = await cookies()
    const dismissed = cookieStore.get('ara_setup_dismissed')?.value === '1'
    const tenantStep = (await fetchOnboardingStep(tenant.id)) as 'tour' | 'skipped' | null
    if (tenantStep === 'tour' && !dismissed) redirect('/admin/setup')
  }

  return (
    <>
      <ThemeInjector
        branding={{
          primaryColor: tenant.primaryColor,
          secondaryColor: tenant.secondaryColor,
          accentColor: tenant.accentColor,
        }}
      />
      <SwipeNavigator>
        <div className="min-h-screen bg-bg text-fg pb-[calc(env(safe-area-inset-bottom)+4.5rem)]">
          {!onboarding.completed ? <OnboardingBanner state={onboarding} /> : null}
          {children}
        </div>
      </SwipeNavigator>
      <GlobalFab />
      <BottomTabNav />
    </>
  )
}
