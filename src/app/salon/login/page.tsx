import { redirect } from 'next/navigation'
import { BarberStripeOrnament, AraLabsMark } from '@/components/brand/logo'
import { TenantLogo } from '@/components/branding/tenant-logo'
import { ThemeInjector } from '@/components/branding/theme-injector'
import { Card } from '@/components/ui/card'
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
        <div className="relative z-10 mx-auto grid w-full max-w-7xl lg:min-h-screen lg:grid-cols-[1.05fr_1fr]">
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

          {/* Mobile + desktop direita: hero tight + card do formulário */}
          <section className="flex flex-col px-5 pt-10 pb-8 sm:px-6 lg:items-center lg:justify-center lg:px-14 lg:pt-0 lg:pb-0">
            <div className="mx-auto w-full max-w-md lg:max-w-105">
              {/* Hero mobile — logo + nome centrados. Some no desktop (aside cobre). */}
              <div className="mb-6 flex flex-col items-center gap-3 text-center lg:hidden">
                <TenantLogo logoUrl={tenant.logoUrl} name={tenant.name} size={72} />
                <div>
                  <h1 className="font-display text-[1.375rem] font-semibold leading-tight tracking-tight text-fg">
                    {tenant.name}
                  </h1>
                  <p className="mt-0.5 text-[0.75rem] uppercase tracking-[0.16em] text-fg-subtle">
                    Portal da equipe
                  </p>
                </div>
              </div>

              {/* Card do formulário — padding generoso, sombra suave */}
              <Card className="shadow-md">
                <div className="px-6 pt-7 pb-4 sm:px-7 sm:pt-8">
                  <h2 className="font-display text-[1.625rem] font-semibold leading-tight tracking-tight text-fg sm:text-[1.75rem] lg:text-[2rem]">
                    Entrar
                    <span className="text-brand-accent">.</span>
                  </h2>
                  <p className="mt-2 text-[0.875rem] leading-relaxed text-fg-muted">
                    Use o e-mail que o dono do salão cadastrou pra você.
                  </p>
                </div>

                <div className="px-6 pb-6 sm:px-7 sm:pb-7">
                  <SalonLoginForm />
                </div>
              </Card>

              {/* Rodapé mobile: atribuição AraLabs. Some no desktop (aside cobre). */}
              <div className="mt-6 flex items-center justify-center gap-1.5 text-[0.7rem] text-fg-subtle lg:hidden">
                <span>Feito com</span>
                <AraLabsMark className="h-3 w-auto text-fg-subtle" />
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
