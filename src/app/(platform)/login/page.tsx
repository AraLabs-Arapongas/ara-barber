import { redirect } from 'next/navigation'
import { getCurrentArea } from '@/lib/tenant/context'
import { getSessionUser } from '@/lib/auth/session'
import { isPlatformAdminRole } from '@/lib/auth/roles'
import { Card } from '@/components/ui/card'
import { LoginForm } from './login-form'

export default async function PlatformLoginPage() {
  const area = await getCurrentArea()
  if (area !== 'platform') redirect('/')

  const user = await getSessionUser()
  if (user?.profile && isPlatformAdminRole(user.profile.role)) {
    redirect('/dashboard')
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <Card className="w-full max-w-sm p-8">
        <h1 className="font-display text-[1.5rem] font-semibold text-fg">AraLabs Admin</h1>
        <p className="mt-1 text-[0.8125rem] text-fg-muted">Entre com seu email institucional.</p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </Card>
    </main>
  )
}
