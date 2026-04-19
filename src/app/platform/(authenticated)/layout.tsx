import { redirect } from 'next/navigation'
import { assertPlatformAdmin, AuthError } from '@/lib/auth/guards'

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

  return <div className="min-h-screen bg-bg-subtle text-fg">{children}</div>
}
