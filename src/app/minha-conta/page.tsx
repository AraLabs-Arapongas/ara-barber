import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Calendar } from 'lucide-react'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { ThemeInjector } from '@/components/branding/theme-injector'
import { TenantLogo } from '@/components/branding/tenant-logo'
import { AraLabsAttribution } from '@/components/brand/aralabs-attribution'
import { Button } from '@/components/ui/button'
import { CustomerShell } from '@/components/customer/customer-shell'
import { CustomerQuickActions } from '@/components/home/customer-quick-actions'
import { LoyaltyStamps } from '@/components/home/loyalty-stamps'
import { UpcomingAppointmentsCarousel } from '@/components/home/upcoming-appointments-carousel'
import { RealtimeAppointmentsRefresh } from '@/components/appointments/realtime-refresh'
import { createClient } from '@/lib/supabase/server'
import { getCustomerForTenant } from '@/lib/customers/ensure'
import { getMyCustomerAppointments } from '@/lib/appointments/queries'

/**
 * Área "app" do cliente logado. Substitui a antiga home recheada
 * (greeting + próximas reservas + ações rápidas + fidelidade) que
 * agora vive separada da landing pública.
 *
 * Anônimos são redirecionados pra `/admin/login` (mesma porta de
 * entrada de cliente; o login decide pra onde despachar).
 */
export default async function MinhaContaPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const customer = await getCustomerForTenant(tenant.id)
  if (!customer) redirect('/')

  const appointments = await getMyCustomerAppointments(tenant.id)
  // eslint-disable-next-line react-hooks/purity -- server component, precisa saber o "agora"
  const nowMs = Date.now()
  const upcoming = appointments
    .filter(
      (a) =>
        new Date(a.startAt).getTime() >= nowMs && a.status !== 'CANCELED' && a.status !== 'NO_SHOW',
    )
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 5)

  const displayName = customer.name ?? user.email ?? null

  return (
    <>
      <ThemeInjector
        branding={{
          primaryColor: tenant.primaryColor,
          secondaryColor: tenant.secondaryColor,
          accentColor: tenant.accentColor,
        }}
      />
      <RealtimeAppointmentsRefresh tenantId={tenant.id} channelKey="minha-conta" />
      <CustomerShell showTabBar>
        <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-5 pt-6 pb-12 sm:px-6">
          <header className="flex items-center gap-3">
            <TenantLogo logoUrl={tenant.logoUrl} name={tenant.name} size={48} />
            <div className="min-w-0">
              <h1 className="truncate font-display text-[1.125rem] font-semibold leading-tight tracking-tight text-fg">
                {tenant.name}
              </h1>
              <Link
                href="/"
                className="text-[0.75rem] text-fg-muted underline-offset-4 hover:underline"
              >
                ← Página inicial
              </Link>
            </div>
          </header>

          <section className="mt-2">
            <h2 className="font-display text-[1.5rem] font-semibold leading-tight tracking-tight text-fg">
              Olá, {firstName(displayName ?? '')}
            </h2>
          </section>

          {upcoming.length > 0 ? (
            <section>
              <p className="mb-2 px-1 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
                {upcoming.length === 1
                  ? 'Sua próxima reserva'
                  : `Suas próximas reservas (${upcoming.length})`}
              </p>
              <UpcomingAppointmentsCarousel
                appointments={upcoming.map((a) => ({
                  id: a.id,
                  serviceId: a.serviceId,
                  serviceName: a.serviceName,
                  professionalId: a.professionalId,
                  professionalName: a.professionalName,
                  startAt: a.startAt,
                  status: a.status,
                }))}
                tenantTimezone={tenant.timezone}
                cancellationWindowHours={tenant.cancellationWindowHours}
                customerCanCancel={tenant.customerCanCancel}
              />
            </section>
          ) : (
            <section className="rounded-2xl border border-dashed border-border bg-bg-subtle px-4 py-6 text-center">
              <p className="text-[0.875rem] text-fg-muted">
                Você não tem reservas marcadas. Que tal agendar a próxima?
              </p>
            </section>
          )}

          <section>
            <Link href="/book" className="inline-block w-full">
              <Button size="lg" fullWidth>
                <Calendar className="h-4 w-4" aria-hidden="true" />
                Nova reserva
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
          </section>

          <CustomerQuickActions
            contactPhone={tenant.contactPhone}
            whatsapp={tenant.whatsapp}
            address={{
              line1: tenant.addressLine1,
              line2: tenant.addressLine2,
              city: tenant.city,
              state: tenant.state,
              postalCode: tenant.postalCode,
            }}
          />

          <LoyaltyStamps />

          <footer className="mt-auto flex justify-center pt-6">
            <AraLabsAttribution />
          </footer>
        </main>
      </CustomerShell>
    </>
  )
}

function firstName(full: string): string {
  const trimmed = full.trim()
  if (!trimmed) return ''
  return trimmed.split(/\s+/)[0]
}
