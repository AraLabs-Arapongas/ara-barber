import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Calendar, ExternalLink } from 'lucide-react'
import { getCurrentTenantOrNotFound, getCurrentTenantSlug } from '@/lib/tenant/context'
import { buildTenantMetadata } from '@/lib/tenant/metadata'
import { ThemeInjector } from '@/components/branding/theme-injector'
import { TenantLogo } from '@/components/branding/tenant-logo'
import { AraLabsMark } from '@/components/brand/logo'
import { AraLabsAttribution } from '@/components/brand/aralabs-attribution'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CustomerAccess } from '@/components/home/customer-access'
import { CustomerQuickActions } from '@/components/home/customer-quick-actions'
import { BusinessHoursAccordion } from '@/components/home/business-hours-accordion'
import { LoyaltyStamps } from '@/components/home/loyalty-stamps'
import { CustomerShell } from '@/components/customer/customer-shell'
import { createClient } from '@/lib/supabase/server'
import { getCustomerForTenant } from '@/lib/customers/ensure'
import { getBusinessHours } from '@/lib/booking/queries'
import { getMyCustomerAppointments, type AgendaAppointment } from '@/lib/appointments/queries'
import { STATUS_LABELS, STATUS_TONE } from '@/lib/appointments/labels'

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers()
  const area = h.get('x-ara-area')
  const tenantMissing = h.get('x-ara-tenant-missing') === '1'

  if (area !== 'tenant' || tenantMissing) return {}

  // Tenant válido: lê e devolve metadata personalizada.
  const tenant = await getCurrentTenantOrNotFound()
  const slug = await getCurrentTenantSlug()

  return buildTenantMetadata(tenant, {
    description: `Agende seu horário em ${tenant.name}.`,
    manifest: slug ? `/api/manifest/${slug}` : undefined,
  })
}

export default async function RootPage() {
  const h = await headers()
  const area = h.get('x-ara-area')
  const tenantMissing = h.get('x-ara-tenant-missing') === '1'

  // Subdomínio válido em formato mas sem tenant no DB → renderiza o 404 tematizado
  // inline (ao invés de chamar notFound(), que em Next 16 dev dispara o error shell
  // em vez do not-found.tsx). Status HTTP segue 200; quando necessário, ajustar
  // via rewrite do proxy. TODO Épico 10.
  if (tenantMissing) return <TenantNotFound />

  if (area === 'tenant') return <TenantPublicHome />

  // area === 'root'. Apex pertence à storefront AraLabs (outro repo).
  // Em prod, qualquer request que chegue aqui é redirecionada pra lá.
  // Em dev (localhost), mostra um índice de atalhos pro desenvolvedor navegar entre tenants.
  if (process.env.NEXT_PUBLIC_ENV !== 'development') {
    redirect('https://aralabs.com.br')
  }

  return <DevRootIndex />
}

/**
 * Tela exibida quando o subdomínio não corresponde a um tenant cadastrado.
 * Renderizada pelo próprio page.tsx (não via notFound()) para evitar o error
 * shell do Next 16 dev mode.
 */
function TenantNotFound() {
  return (
    <main className="noise-overlay relative flex min-h-screen flex-col bg-bg px-6 py-10">
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center text-center">
        <AraLabsMark className="mb-8 h-14 w-auto text-brand-primary" />
        <p className="mb-3 font-display text-[5rem] font-semibold leading-none tracking-tight text-fg sm:text-[6rem]">
          404
        </p>
        <h1 className="mb-3 font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg sm:text-[2.25rem]">
          Esse endereço não está <span className="italic text-brand-primary">ativo</span>
          <span className="text-brand-accent">.</span>
        </h1>
        <p className="max-w-sm text-[0.9375rem] leading-relaxed text-fg-muted">
          A página que você procurou não existe ou o endereço mudou. Confira o link ou volte pra
          raiz.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Link href="https://aralabs.com.br">
            <Button size="lg" variant="primary">
              Conhecer a AraLabs
            </Button>
          </Link>
        </div>
      </div>
      <footer className="relative z-10 flex justify-center">
        <AraLabsAttribution />
      </footer>
    </main>
  )
}

/**
 * Home do tenant quando acessado via `<slug>.aralabs.com.br`.
 */
async function TenantPublicHome() {
  const tenant = await getCurrentTenantOrNotFound()
  const unavailable = tenant.status !== 'ACTIVE' || tenant.billingStatus === 'SUSPENDED'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let loggedIn = false
  let displayName: string | null = null
  let emailForHome: string | null = null
  if (user && !unavailable) {
    const customer = await getCustomerForTenant(tenant.id)
    if (customer) {
      loggedIn = true
      displayName = customer.name
      emailForHome = customer.email ?? user.email ?? null
    }
  }

  if (unavailable) {
    return (
      <>
        <ThemeInjector
          branding={{
            primaryColor: tenant.primaryColor,
            secondaryColor: tenant.secondaryColor,
            accentColor: tenant.accentColor,
          }}
        />
        <main className="flex min-h-screen items-center justify-center bg-bg p-6">
          <div className="max-w-sm text-center">
            <h1 className="font-display text-2xl font-semibold text-fg">
              Estabelecimento indisponível
            </h1>
            <p className="mt-3 text-[0.9375rem] text-fg-muted">
              Este estabelecimento está temporariamente fora do ar. Tente de novo mais tarde.
            </p>
          </div>
        </main>
      </>
    )
  }

  const [businessHours, myAppointments] = await Promise.all([
    getBusinessHours(tenant.id),
    loggedIn ? getMyCustomerAppointments(tenant.id) : Promise.resolve([]),
  ])

  // eslint-disable-next-line react-hooks/purity -- server component, precisa saber o "agora"
  const nowMs = Date.now()
  const nextAppointment =
    myAppointments.find(
      (a) =>
        new Date(a.startAt).getTime() >= nowMs && a.status !== 'CANCELED' && a.status !== 'NO_SHOW',
    ) ?? null

  return (
    <>
      <ThemeInjector
        branding={{
          primaryColor: tenant.primaryColor,
          secondaryColor: tenant.secondaryColor,
          accentColor: tenant.accentColor,
        }}
      />

      <CustomerShell showTabBar={loggedIn}>
        <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-5 pt-6 pb-12 sm:px-6">
          {/* Logo do tenant — compacto pra deixar a próxima reserva ganhar
              destaque. Antes era 350px e empurrava todo o conteúdo. */}
          <header className="flex flex-col items-center gap-2 text-center">
            <TenantLogo logoUrl={tenant.logoUrl} name={tenant.name} size={120} />
          </header>

          {/* Bloco 1 — Próxima reserva: prioridade máxima quando existe.
              Cliente quase sempre abre o app pra ver "tenho algo marcado?" */}
          {nextAppointment ? (
            <section>
              <p className="mb-2 px-1 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
                Sua próxima reserva
              </p>
              <NextAppointmentCard appt={nextAppointment} tenantTimezone={tenant.timezone} />
            </section>
          ) : null}

          {/* Bloco 2 — CTA principal (Nova reserva). Vira "Agendar agora"
              quando ainda não há histórico, mas sempre conceito é o mesmo. */}
          <section className="text-center">
            <Link href="/book" className="inline-block w-full">
              <Button size="lg" fullWidth>
                <Calendar className="h-4 w-4" aria-hidden="true" />
                Nova reserva
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
          </section>

          {/* Bloco 3 — Ações rápidas: aparece se há próxima reserva
              (Reagendar) OU se tenant tem contato (Falar/Ligar).
              "Ver reservas" sempre presente quando logado. */}
          {loggedIn ? (
            <CustomerQuickActions
              nextAppointment={
                nextAppointment
                  ? {
                      id: nextAppointment.id,
                      serviceId: nextAppointment.serviceId,
                      professionalId: nextAppointment.professionalId,
                    }
                  : null
              }
              contactPhone={tenant.contactPhone}
              whatsapp={tenant.whatsapp}
            />
          ) : null}

          {/* Bloco 4 — Programa de pontos (mockado, feature flag).
              Só renderiza pra logado. */}
          {loggedIn ? <LoyaltyStamps /> : null}

          {/* Bloco 5 — Funcionamento: accordion fechado por default.
              Útil mas não disputa protagonismo com a reserva. */}
          {businessHours.length > 0 ? <BusinessHoursAccordion hours={businessHours} /> : null}

          {/* Login / signup pra anônimos. Logged-in não vê (já está dentro). */}
          {!loggedIn ? (
            <div className="mt-2 flex flex-col items-center">
              <CustomerAccess loggedIn={loggedIn} displayName={displayName} email={emailForHome} />
            </div>
          ) : null}

          <footer className="mt-auto flex justify-center pt-6">
            <AraLabsAttribution />
          </footer>
        </main>
      </CustomerShell>
    </>
  )
}

/**
 * Card "Sua próxima reserva" — versão hero, mais alta visualmente.
 * Mostra serviço grande, data por extenso, profissional e status.
 * É o primeiro elemento da home (depois do logo) — onde o cliente
 * pousa primeiro o olho.
 */
function NextAppointmentCard({
  appt,
  tenantTimezone,
}: {
  appt: AgendaAppointment
  tenantTimezone: string
}) {
  const date = new Date(appt.startAt)
  const dateLabel = new Intl.DateTimeFormat('pt-BR', {
    timeZone: tenantTimezone,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(date)
  const timeLabel = new Intl.DateTimeFormat('pt-BR', {
    timeZone: tenantTimezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)

  return (
    <Link href={`/meus-agendamentos/${appt.id}`} className="block">
      <Card className="shadow-xs border-brand-primary/20 bg-brand-primary/5 transition-colors hover:bg-brand-primary/10">
        <CardContent className="py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-display text-[1.25rem] font-semibold leading-tight tracking-tight text-fg">
                {appt.serviceName ?? 'Serviço'}
              </p>
              <p className="mt-1 text-[0.875rem] capitalize text-fg-muted">{dateLabel}</p>
              <p className="mt-0.5 font-display text-[1.125rem] font-semibold tracking-tight text-fg">
                {timeLabel}
              </p>
              {appt.professionalName ? (
                <p className="mt-1 text-[0.8125rem] text-fg-muted">
                  com <span className="text-fg">{appt.professionalName}</span>
                </p>
              ) : null}
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide ${STATUS_TONE[appt.status]}`}
            >
              {STATUS_LABELS[appt.status]}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

/**
 * Índice de desenvolvimento — mostrado apenas em `localhost` (area=root).
 * Em produção esta tela não existe: o apex redireciona para o site institucional.
 * Usa a porta atual e o dev base host do env; facilita pular entre áreas.
 */
function DevRootIndex() {
  const devBase = process.env.NEXT_PUBLIC_DEV_BASE_HOST ?? 'lvh.me'
  const port = '3008'
  const tenants = ['barbearia-teste', 'casa-do-corte', 'barba-preta', 'bela-imagem'] as const
  const aralabsSite = 'https://aralabs.com.br'

  const links = tenants.flatMap((slug) => {
    const host = `${slug}.${devBase}:${port}`
    return [
      {
        label: `Home pública · ${slug}`,
        url: `http://${host}/`,
        hint: `${host} · cliente final`,
      },
      {
        label: `Login staff · ${slug}`,
        url: `http://${host}/admin/login`,
        hint: `${host} · equipe do negócio`,
      },
      {
        label: `Manifest PWA · ${slug}`,
        url: `http://${host}/api/manifest/${slug}`,
        hint: 'manifest.webmanifest dinâmico',
      },
    ]
  })

  return (
    <main className="relative flex min-h-screen flex-col bg-bg-subtle px-6 py-12 sm:px-10">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-10 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <AraLabsMark className="h-10 w-auto text-brand-primary" />
            <div>
              <p className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-fg-subtle">
                Ara Barber · dev
              </p>
              <h1 className="font-display text-[1.5rem] font-semibold tracking-tight text-fg">
                Índice local
              </h1>
            </div>
          </div>
          <a
            href={aralabsSite}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[0.8125rem] text-fg-muted underline-offset-4 hover:text-fg hover:underline"
          >
            aralabs.com.br
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </header>

        <p className="mb-6 max-w-lg text-[0.9375rem] text-fg-muted">
          Esta tela só aparece em dev. Em produção, o apex <code>aralabs.com.br</code> pertence ao
          site institucional da AraLabs; este app responde apenas em{' '}
          <code>admin.aralabs.com.br</code> e <code>&lt;slug&gt;.aralabs.com.br</code>.
        </p>

        <ul className="space-y-2">
          {links.map((item) => (
            <li key={item.url}>
              <a
                href={item.url}
                className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-surface px-4 py-3 shadow-xs transition-colors hover:border-border-strong hover:bg-surface-raised"
              >
                <div className="min-w-0">
                  <p className="font-medium text-fg">{item.label}</p>
                  <p className="truncate text-[0.8125rem] text-fg-muted">{item.hint}</p>
                </div>
                <ArrowRight
                  className="h-4 w-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-fg"
                  aria-hidden="true"
                />
              </a>
            </li>
          ))}
        </ul>

        <div className="mt-12 flex justify-center border-t border-border pt-6">
          <AraLabsAttribution />
        </div>
      </div>
    </main>
  )
}
