import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Clock, ExternalLink } from 'lucide-react'
import { getCurrentTenantOrNotFound, getCurrentTenantSlug } from '@/lib/tenant/context'
import { buildTenantMetadata } from '@/lib/tenant/metadata'
import { ThemeInjector } from '@/components/branding/theme-injector'
import { TenantLogo } from '@/components/branding/tenant-logo'
import { AraLabsMark } from '@/components/brand/logo'
import { AraLabsAttribution } from '@/components/brand/aralabs-attribution'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CustomerAccess } from '@/components/home/customer-access'
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
          Esse endereço não está{' '}
          <span className="italic text-brand-primary">ativo</span>
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
        new Date(a.startAt).getTime() >= nowMs &&
        a.status !== 'CANCELED' &&
        a.status !== 'NO_SHOW',
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
        <main className="mx-auto flex w-full max-w-xl flex-col px-5 pt-8 pb-12 sm:px-6">
          <header className="mb-6 flex flex-col items-center gap-4 text-center">
            <TenantLogo logoUrl={tenant.logoUrl} name={tenant.name} size={350} />
          </header>

          <section className="mb-2 text-center">
            <Link href="/book" className="inline-block w-full max-w-xs">
              <Button size="lg" fullWidth>
                {nextAppointment ? 'Agendar novamente' : 'Agendar agora'}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
            <p className="mt-3 text-[0.8125rem] text-fg-muted">
              Escolha serviço, profissional e horário.
            </p>
          </section>

          {nextAppointment ? (
            <section className="mb-2">
              <p className="mb-2 px-1 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
                Sua próxima reserva
              </p>
              <NextAppointmentCard
                appt={nextAppointment}
                tenantTimezone={tenant.timezone}
              />
            </section>
          ) : null}

          {businessHours.length > 0 ? (
            <section className="mb-2">
              <p className="mb-2 px-1 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
                Horário de funcionamento
              </p>
              <Card className="shadow-xs">
                <CardContent className="py-3">
                  <BusinessHoursList hours={businessHours} />
                </CardContent>
              </Card>
            </section>
          ) : null}

          <div className="mb-4 mt-2 flex flex-col items-center">
            <CustomerAccess
              loggedIn={loggedIn}
              displayName={displayName}
              email={emailForHome}
            />
          </div>

          <footer className="mt-auto flex justify-center pt-6">
            <AraLabsAttribution />
          </footer>
        </main>
      </CustomerShell>
    </>
  )
}

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const

function BusinessHoursList({
  hours,
}: {
  hours: Array<{ weekday: number; isOpen: boolean; startTime: string; endTime: string }>
}) {
  // Ordena semana começando na segunda (weekday 1..6, 0) pra leitura mais natural
  const sorted = [...hours].sort((a, b) => {
    const aw = a.weekday === 0 ? 7 : a.weekday
    const bw = b.weekday === 0 ? 7 : b.weekday
    return aw - bw
  })
  return (
    <ul className="space-y-1 text-[0.875rem]">
      {sorted.map((h) => (
        <li key={h.weekday} className="flex items-center justify-between">
          <span className="font-medium text-fg">{WEEKDAY_LABELS[h.weekday]}</span>
          <span className="text-fg-muted">
            {h.isOpen ? `${h.startTime.slice(0, 5)} – ${h.endTime.slice(0, 5)}` : 'Fechado'}
          </span>
        </li>
      ))}
    </ul>
  )
}

function NextAppointmentCard({
  appt,
  tenantTimezone,
}: {
  appt: AgendaAppointment
  tenantTimezone: string
}) {
  const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: tenantTimezone,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <Link href={`/meus-agendamentos/${appt.id}`} className="block">
      <Card className="shadow-xs transition-colors hover:bg-bg-subtle">
        <CardContent className="flex items-center gap-3 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
            <Clock className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-fg">
              {appt.serviceName ?? 'Serviço'}
            </p>
            <p className="truncate text-[0.8125rem] text-fg-muted">
              {dateTimeFmt.format(new Date(appt.startAt))}
              {appt.professionalName ? ` · ${appt.professionalName}` : ''}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide ${STATUS_TONE[appt.status]}`}
          >
            {STATUS_LABELS[appt.status]}
          </span>
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
  const tenants = [
    'barbearia-teste',
    'casa-do-corte',
    'barba-preta',
    'bela-imagem',
  ] as const
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
