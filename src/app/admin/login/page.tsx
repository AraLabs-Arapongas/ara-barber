import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BarberStripeOrnament } from '@/components/brand/logo'
import { AraLabsAttribution } from '@/components/brand/aralabs-attribution'
import { TenantLogo } from '@/components/branding/tenant-logo'
import { ThemeInjector } from '@/components/branding/theme-injector'
import { Card } from '@/components/ui/card'
import { getSessionUser } from '@/lib/auth/session'
import { isStaffRole } from '@/lib/auth/roles'
import { getCurrentArea, getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { AdminLoginForm } from './login-form'

export default async function AdminLoginPage() {
  // /admin/login só faz sentido num subdomínio de tenant. Redirect para raiz
  // se alguém acessar de localhost/admin host.
  const area = await getCurrentArea()
  if (area !== 'tenant') redirect('/')

  const tenant = await getCurrentTenantOrNotFound()

  // Se já tem sessão de staff do MESMO tenant, pula direto pro dashboard.
  const user = await getSessionUser()
  if (user?.profile && isStaffRole(user.profile.role) && user.profile.tenantId === tenant.id) {
    redirect('/admin/dashboard')
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

      <main className="noise-overlay relative flex min-h-screen flex-col bg-bg">
        {/* Ornamento decorativo em background — bem sutil, some em mobile. */}
        <div className="pointer-events-none absolute inset-0 hidden opacity-60 lg:block">
          <BarberStripeOrnament />
        </div>

        <div className="relative z-10 flex flex-1 flex-col justify-center px-5 py-10 sm:px-6">
          <div className="mx-auto flex w-full max-w-md flex-col">
            {/* Hero: tenant logo + nome centrados */}
            <Link
              href="/"
              aria-label={`Página inicial de ${tenant.name}`}
              className="mb-6 flex flex-col items-center gap-3 text-center transition-opacity hover:opacity-80"
            >
              <TenantLogo logoUrl={tenant.logoUrl} name={tenant.name} size={72} />
              <div>
                <h1 className="font-display text-[1.5rem] font-semibold leading-tight tracking-tight text-fg">
                  {tenant.name}
                </h1>
                <p className="mt-0.5 text-[0.75rem] uppercase tracking-[0.16em] text-fg-subtle">
                  Portal da equipe
                </p>
              </div>
            </Link>

            {/* Card do formulário */}
            <Card className="shadow-md">
              <div className="px-6 pt-7 pb-4 sm:px-7 sm:pt-8">
                <h2 className="font-display text-[1.625rem] font-semibold leading-tight tracking-tight text-fg sm:text-[1.75rem]">
                  Entrar
                  <span className="text-brand-accent">.</span>
                </h2>
                <p className="mt-2 text-[0.875rem] leading-relaxed text-fg-muted">
                  Use o e-mail que o responsável pelo negócio cadastrou pra você.
                </p>
              </div>

              <div className="px-6 pb-6 sm:px-7 sm:pb-7">
                <AdminLoginForm />
              </div>
            </Card>
          </div>
        </div>

        {/* Rodapé fixo no fim da página */}
        <footer className="relative z-10 flex justify-center px-6 pt-10 pb-8">
          <AraLabsAttribution />
        </footer>
      </main>
    </>
  )
}
