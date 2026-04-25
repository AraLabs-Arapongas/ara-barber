import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { ThemeInjector } from '@/components/branding/theme-injector'
import { assertStaff, AuthError } from '@/lib/auth/guards'
import { BottomTabNav } from '@/components/nav/bottom-tab-nav'
import { GlobalFab } from '@/components/nav/global-fab'

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

  return (
    <>
      <ThemeInjector
        branding={{
          primaryColor: tenant.primaryColor,
          secondaryColor: tenant.secondaryColor,
          accentColor: tenant.accentColor,
        }}
      />
      <div className="min-h-screen bg-bg text-fg pb-[calc(env(safe-area-inset-bottom)+4.5rem)]">
        {children}
      </div>
      <GlobalFab />
      <BottomTabNav />
    </>
  )
}
