import { redirect } from 'next/navigation'
import { assertPlatformAdmin, AuthError } from '@/lib/auth/guards'
import { PlatformSidebar } from '@/components/platform/sidebar'
import { PlatformUserMenu } from '@/components/platform/user-menu'

export default async function PlatformAuthLayout({ children }: { children: React.ReactNode }) {
  let user
  try {
    user = await assertPlatformAdmin()
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.code === 'UNAUTHORIZED') redirect('/login')
      redirect('/login?error=forbidden')
    }
    throw err
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-border bg-bg-subtle">
        <div className="flex h-14 items-center border-b border-border px-4">
          <span className="font-display text-[0.9375rem] font-semibold text-fg">
            AraLabs Admin
          </span>
        </div>
        <PlatformSidebar />
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-end border-b border-border px-6">
          <PlatformUserMenu name={user.profile.name} email={user.email ?? ''} />
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
