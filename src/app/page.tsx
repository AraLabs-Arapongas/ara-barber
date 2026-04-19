import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import {
  getCurrentArea,
  getCurrentTenantOrNotFound,
  getCurrentTenantSlug,
} from '@/lib/tenant/context'
import { ThemeInjector } from '@/components/branding/theme-injector'
import { TenantLogo } from '@/components/branding/tenant-logo'
import { Wordmark } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'

export async function generateMetadata(): Promise<Metadata> {
  const area = await getCurrentArea()
  if (area !== 'tenant') return {}

  const tenant = await getCurrentTenantOrNotFound()
  const slug = await getCurrentTenantSlug()

  return {
    title: tenant.name,
    description: `Agende seu horário no ${tenant.name}.`,
    manifest: slug ? `/api/manifest/${slug}` : undefined,
    icons: tenant.faviconUrl ? [{ rel: 'icon', url: tenant.faviconUrl }] : undefined,
    appleWebApp: { title: tenant.name, capable: true, statusBarStyle: 'default' },
  }
}

export default async function RootPage() {
  const area = await getCurrentArea()

  if (area === 'platform') redirect('/platform')
  if (area === 'tenant') return <TenantPublicHome />
  return <AraLabsMarketing />
}

/**
 * Home do tenant quando acessado via `<slug>.aralabs.com.br`.
 * Branding injetado via ThemeInjector (override dos --brand-* do sistema).
 */
async function TenantPublicHome() {
  const tenant = await getCurrentTenantOrNotFound()
  const unavailable = tenant.status !== 'ACTIVE' || tenant.billingStatus === 'SUSPENDED'

  return (
    <>
      <ThemeInjector
        branding={{
          primaryColor: tenant.primaryColor,
          secondaryColor: tenant.secondaryColor,
          accentColor: tenant.accentColor,
        }}
      />

      {unavailable ? (
        <main className="flex min-h-screen items-center justify-center bg-bg p-6">
          <div className="max-w-sm text-center">
            <h1 className="font-display text-2xl font-semibold text-fg">Salão indisponível</h1>
            <p className="mt-3 text-[0.9375rem] text-fg-muted">
              Este salão está temporariamente fora do ar. Tente de novo mais tarde.
            </p>
          </div>
        </main>
      ) : (
        <main className="noise-overlay relative flex min-h-screen flex-col bg-bg">
          <header className="relative z-10 flex items-center gap-4 px-5 pt-8 sm:px-8">
            <TenantLogo logoUrl={tenant.logoUrl} name={tenant.name} size={56} />
            <div className="min-w-0">
              <h1 className="font-display text-[1.5rem] font-semibold tracking-tight text-fg leading-tight">
                {tenant.name}
              </h1>
              <p className="text-[0.8125rem] text-fg-muted">Barbearia · {tenant.timezone}</p>
            </div>
          </header>

          <section className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
            <p className="mb-2 text-[0.75rem] font-medium uppercase tracking-[0.18em] text-fg-subtle">
              Agendamento online
            </p>
            <h2 className="font-display text-[2.5rem] leading-[1.05] tracking-tight text-fg sm:text-[3rem]">
              Pronto pra
              <br />
              <span
                className="italic text-brand-primary"
                style={{ fontVariationSettings: "'SOFT' 100, 'WONK' 1" }}
              >
                aquele corte
              </span>
              <span className="text-brand-accent">?</span>
            </h2>
            <p className="mt-4 max-w-xs text-[0.9375rem] text-fg-muted sm:max-w-sm">
              Escolha seu profissional, o horário que cabe no seu dia e confirme — sem ligação, sem
              mensagem.
            </p>
            <Link href="/book" className="mt-8 w-full max-w-xs">
              <Button size="lg" fullWidth>
                Agendar agora
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
          </section>

          <footer className="relative z-10 flex items-center justify-center gap-2 px-6 pb-6 text-[0.75rem] text-fg-subtle">
            <span>Feito com</span>
            <Link
              href="https://aralabs.com.br"
              className="underline-offset-4 hover:text-fg hover:underline"
            >
              Ara Barber
            </Link>
          </footer>
        </main>
      )}
    </>
  )
}

/**
 * Landing raiz (aralabs.com.br / localhost:3008). Marketing stub —
 * conteúdo real virá num épico futuro.
 */
function AraLabsMarketing() {
  return (
    <main className="noise-overlay relative flex min-h-screen flex-col bg-bg">
      <header className="relative z-10 flex items-center justify-between px-6 pt-6">
        <Wordmark />
        <Link
          href="/platform/login"
          className="text-[0.8125rem] text-fg-muted underline-offset-4 hover:text-fg hover:underline"
        >
          Entrar
        </Link>
      </header>

      <section className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="mb-3 text-[0.75rem] font-medium uppercase tracking-[0.18em] text-fg-subtle">
          Ara Barber · SaaS para barbearias
        </p>
        <h1 className="font-display text-[2.5rem] leading-[1.02] tracking-tight text-fg sm:text-[3.5rem]">
          Agenda, equipe e clientes
          <br />
          <span
            className="italic text-brand-primary"
            style={{ fontVariationSettings: "'SOFT' 100, 'WONK' 1" }}
          >
            num só lugar
          </span>
          <span className="text-brand-accent">.</span>
        </h1>
        <p className="mt-5 max-w-md text-[1rem] text-fg-muted">
          Feito pra quem corta cabelo, não pra quem programa. Seu salão organizado, acessível do
          celular do cliente ao balcão da loja.
        </p>
      </section>

      <footer className="relative z-10 px-6 pb-6 text-center text-[0.75rem] text-fg-subtle">
        Ara Barber · AraLabs · 2026
      </footer>
    </main>
  )
}
