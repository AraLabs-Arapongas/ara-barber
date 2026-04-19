import { redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Monogram } from '@/components/brand/logo'
import { getSessionUser } from '@/lib/auth/session'
import { isPlatformAdminRole } from '@/lib/auth/roles'
import { PlatformLoginForm } from './login-form'

export default async function PlatformLoginPage() {
  // Se já tem sessão de platform admin ativa, pula direto pro painel.
  const user = await getSessionUser()
  if (user?.profile && isPlatformAdminRole(user.profile.role)) {
    redirect('/platform')
  }

  return (
    <main className="noise-overlay relative flex min-h-screen flex-col bg-bg-subtle">
      <header className="relative z-10 border-b border-border/60 bg-surface/80 px-5 py-4 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Monogram className="h-8 w-8" />
            <span className="font-display text-[1rem] font-semibold tracking-tight text-fg">
              Ara Barber
            </span>
          </div>
          <span className="flex items-center gap-1.5 text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Acesso restrito
          </span>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <Card className="shadow-lg">
            <PlatformLoginForm />
          </Card>

          <p className="mt-6 text-center text-[0.75rem] text-fg-subtle">
            Ara Barber · Plataforma administrativa · v0.1
          </p>
        </div>
      </div>
    </main>
  )
}
