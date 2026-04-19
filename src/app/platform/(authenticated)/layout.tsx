import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { assertPlatformAdmin, AuthError } from '@/lib/auth/guards'
import { getSessionUser } from '@/lib/auth/session'
import { Wordmark } from '@/components/brand/logo'
import { LogoutButton } from '@/components/auth/logout-button'

export const metadata: Metadata = {
  title: {
    default: 'Admin · Ara Barber',
    template: '%s · Admin · Ara Barber',
  },
  description: 'Painel administrativo AraLabs',
}

export default async function PlatformAuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  try {
    await assertPlatformAdmin()
  } catch (err) {
    if (err instanceof AuthError) redirect('/platform/login')
    throw err
  }

  const user = await getSessionUser()

  return (
    <div className="min-h-screen bg-bg-subtle text-fg">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-surface/85 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Wordmark className="text-fg" />
          <div className="flex items-center gap-3">
            <span className="hidden text-[0.8125rem] text-fg-muted sm:inline">
              {user?.profile?.name ?? user?.email}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}
