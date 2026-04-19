import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BarberStripeOrnament, AraLabsMark } from '@/components/brand/logo'
import { TenantLogo } from '@/components/branding/tenant-logo'
import { ThemeInjector } from '@/components/branding/theme-injector'
import { getSessionUser } from '@/lib/auth/session'
import { isStaffRole } from '@/lib/auth/roles'
import { getCurrentArea, getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { SalonLoginForm } from './login-form'

export default async function SalonLoginPage() {
  // /salon/login só faz sentido num subdomínio de tenant. Redirect para raiz
  // se alguém acessar de localhost/admin host.
  const area = await getCurrentArea()
  if (area !== 'tenant') redirect('/')

  const tenant = await getCurrentTenantOrNotFound()

  // Se já tem sessão de staff do MESMO tenant, pula direto pro dashboard.
  const user = await getSessionUser()
  if (user?.profile && isStaffRole(user.profile.role) && user.profile.tenantId === tenant.id) {
    redirect('/salon/dashboard')
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

      <main className="noise-overlay relative min-h-screen bg-bg">
        {/* Mobile top brand — logo do tenant */}
        <header className="relative z-10 flex items-center justify-between px-5 pt-6 lg:hidden">
          <div className="flex items-center gap-2.5">
            <TenantLogo logoUrl={tenant.logoUrl} name={tenant.name} size={36} />
            <span className="font-display text-[1rem] font-semibold tracking-tight text-fg">
              {tenant.name}
            </span>
          </div>
          <Link
            href="/"
            className="text-[0.8125rem] text-fg-muted underline-offset-4 hover:underline"
          >
            Voltar
          </Link>
        </header>

        <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-7xl lg:grid-cols-[1.05fr_1fr]">
          {/* Painel decorativo desktop — branding do tenant */}
          <aside className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-12">
            <BarberStripeOrnament />

            <div className="relative z-10 flex items-center gap-3">
              <TenantLogo logoUrl={tenant.logoUrl} name={tenant.name} size={48} />
              <span className="font-display text-[1.25rem] font-semibold tracking-tight text-fg">
                {tenant.name}
              </span>
            </div>

            <div className="relative z-10 max-w-md space-y-5">
              <p className="text-[0.75rem] font-medium uppercase tracking-[0.18em] text-fg-subtle">
                Portal do salão
              </p>
              <h1 className="font-display text-[2.75rem] leading-[1.05] tracking-[-0.02em] text-fg">
                Bem-vindo de volta ao
                <br />
                <span
                  className="italic text-brand-primary"
                  style={{ fontVariationSettings: "'SOFT' 100, 'WONK' 1" }}
                >
                  {tenant.name}
                </span>
                <span className="text-brand-accent">.</span>
              </h1>
              <p className="max-w-sm text-[1rem] leading-relaxed text-fg-muted">
                Entre com o e-mail cadastrado pelo dono do salão para gerenciar agenda, equipe e
                clientes.
              </p>
            </div>

            <div className="relative z-10 flex items-center gap-2 text-[0.75rem] text-fg-subtle">
              <span>Feito com</span>
              <AraLabsMark className="h-3.5 w-auto text-fg-subtle" />
            </div>
          </aside>

          {/* Formulário */}
          <section className="flex items-center justify-center px-5 pb-10 pt-8 lg:px-14">
            <div className="w-full max-w-105">
              <div className="mb-8 space-y-2">
                <p className="text-[0.8125rem] font-medium uppercase tracking-[0.18em] text-fg-subtle">
                  Equipe do salão
                </p>
                <h2 className="font-display text-[2.25rem] leading-[1.08] tracking-[-0.025em] text-fg">
                  Entrar em{' '}
                  <span
                    className="italic text-brand-primary"
                    style={{ fontVariationSettings: "'SOFT' 100, 'WONK' 1" }}
                  >
                    {tenant.name}
                  </span>
                  <span className="text-brand-accent">.</span>
                </h2>
                <p className="text-[0.9375rem] text-fg-muted">
                  Use o e-mail que o dono do salão cadastrou pra você.
                </p>
              </div>

              <SalonLoginForm />
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
