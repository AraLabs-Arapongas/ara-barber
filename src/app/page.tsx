import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, ExternalLink } from 'lucide-react'
import { getCurrentTenantOrNotFound, getCurrentTenantSlug } from '@/lib/tenant/context'
import { buildTenantMetadata } from '@/lib/tenant/metadata'
import { ThemeInjector } from '@/components/branding/theme-injector'
import { AraLabsMark } from '@/components/brand/logo'
import { AraLabsAttribution } from '@/components/brand/aralabs-attribution'
import { Button } from '@/components/ui/button'
import { CustomerShell } from '@/components/customer/customer-shell'
import { createClient } from '@/lib/supabase/server'
import { getCustomerForTenant } from '@/lib/customers/ensure'
import { getActiveServicesForTenant, getBusinessHours } from '@/lib/booking/queries'
import { getMyCustomerAppointments } from '@/lib/appointments/queries'
import {
  getLandingBlocks,
  getLandingProfessionals,
  getLandingTestimonials,
  type LandingBlockType,
} from '@/lib/landing/queries'
import { HeroBlock } from '@/components/landing/hero-block'
import { ServicesBlock } from '@/components/landing/services-block'
import { DifferentialsBlock } from '@/components/landing/differentials-block'
import { ProfessionalsBlock } from '@/components/landing/professionals-block'
import { TestimonialsBlock } from '@/components/landing/testimonials-block'
import { ContactBlock } from '@/components/landing/contact-block'
import { FinalCtaBlock } from '@/components/landing/final-cta-block'

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers()
  const area = h.get('x-ara-area')
  const tenantMissing = h.get('x-ara-tenant-missing') === '1'

  if (area !== 'tenant' || tenantMissing) return {}

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

  if (tenantMissing) return <TenantNotFound />
  if (area === 'tenant') return <TenantPublicHome />
  if (process.env.NEXT_PUBLIC_ENV !== 'development') {
    redirect('https://aralabs.com.br')
  }
  return <DevRootIndex />
}

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

async function TenantPublicHome() {
  const tenant = await getCurrentTenantOrNotFound()
  const unavailable = tenant.status !== 'ACTIVE' || tenant.billingStatus === 'SUSPENDED'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let loggedIn = false
  let upcomingCount = 0
  if (user && !unavailable) {
    const customer = await getCustomerForTenant(tenant.id)
    if (customer) {
      loggedIn = true
      const myAppts = await getMyCustomerAppointments(tenant.id)
      // eslint-disable-next-line react-hooks/purity -- server component, precisa saber o "agora"
      const nowMs = Date.now()
      upcomingCount = myAppts.filter(
        (a) =>
          new Date(a.startAt).getTime() >= nowMs &&
          a.status !== 'CANCELED' &&
          a.status !== 'NO_SHOW',
      ).length
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

  // Carrega tudo que a landing pode precisar em paralelo. Cada bloco
  // só vai renderizar se enabled e tiver dado, então sobre-buscar é ok.
  const [blocks, services, professionals, testimonials, businessHours] = await Promise.all([
    getLandingBlocks(tenant.id),
    getActiveServicesForTenant(tenant.id),
    getLandingProfessionals(tenant.id),
    getLandingTestimonials(tenant.id),
    getBusinessHours(tenant.id),
  ])

  const enabled = new Map<LandingBlockType, { position: number }>()
  for (const b of blocks) {
    if (b.enabled) enabled.set(b.blockType, { position: b.position })
  }
  const ordered = [...enabled.entries()].sort((a, b) => a[1].position - b[1].position)

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
        {loggedIn && upcomingCount > 0 ? (
          <header className="absolute left-0 right-0 top-0 z-20 flex justify-end px-5 pt-5 sm:px-8 sm:pt-7">
            <Link
              href="/minha-conta"
              className="rounded-full border border-white/40 bg-white/10 px-3.5 py-1.5 text-[0.75rem] font-medium uppercase tracking-[0.12em] text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              Minha conta
            </Link>
          </header>
        ) : null}

        <main className="mx-auto flex w-full max-w-3xl flex-col gap-20 px-4 pb-16 sm:gap-28 sm:px-6 sm:pb-20">

          {ordered.map(([blockType]) => {
            switch (blockType) {
              case 'HERO':
                return (
                  <HeroBlock
                    key="HERO"
                    eyebrow={tenant.heroEyebrow}
                    headlineTop={tenant.homeHeadlineTop}
                    headlineAccent={tenant.homeHeadlineAccent}
                    subheadline={tenant.heroSubheadline}
                    imageUrl={tenant.heroImageUrl}
                    imageUrlDesktop={tenant.heroImageUrlDesktop}
                  />
                )
              case 'SERVICES':
                return <ServicesBlock key="SERVICES" services={services} />
              case 'DIFFERENTIALS':
                return <DifferentialsBlock key="DIFFERENTIALS" items={tenant.differentials} />
              case 'PROFESSIONALS':
                return <ProfessionalsBlock key="PROFESSIONALS" professionals={professionals} />
              case 'TESTIMONIALS':
                return <TestimonialsBlock key="TESTIMONIALS" testimonials={testimonials} />
              case 'CONTACT':
                return (
                  <ContactBlock
                    key="CONTACT"
                    whatsapp={tenant.whatsapp}
                    contactPhone={tenant.contactPhone}
                    addressLine1={tenant.addressLine1}
                    addressLine2={tenant.addressLine2}
                    city={tenant.city}
                    state={tenant.state}
                    postalCode={tenant.postalCode}
                    businessHours={businessHours}
                  />
                )
              case 'FINAL_CTA':
                return (
                  <FinalCtaBlock
                    key="FINAL_CTA"
                    instagramUrl={tenant.instagramUrl}
                    facebookUrl={tenant.facebookUrl}
                    tiktokUrl={tenant.tiktokUrl}
                  />
                )
              default:
                return null
            }
          })}

          <footer className="flex justify-center pt-4">
            <AraLabsAttribution />
          </footer>
        </main>
      </CustomerShell>
    </>
  )
}

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
                ara-agenda · dev
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
