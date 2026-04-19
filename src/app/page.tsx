import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, ExternalLink } from 'lucide-react'
import { getCurrentTenantOrNotFound, getCurrentTenantSlug } from '@/lib/tenant/context'
import { ThemeInjector } from '@/components/branding/theme-injector'
import { TenantLogo } from '@/components/branding/tenant-logo'
import { AraLabsMark } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers()
  const area = h.get('x-ara-area')
  const tenantMissing = h.get('x-ara-tenant-missing') === '1'

  if (area !== 'tenant' || tenantMissing) return {}

  // Tenant válido: lê e devolve metadata personalizada.
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
          <span
            className="italic text-brand-primary"
            style={{ fontVariationSettings: "'SOFT' 100, 'WONK' 1" }}
          >
            ativo
          </span>
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
      <footer className="relative z-10 text-center text-[0.75rem] text-fg-subtle">
        Ara Barber · AraLabs
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
 * Índice de desenvolvimento — mostrado apenas em `localhost` (area=root).
 * Em produção esta tela não existe: o apex redireciona para o site institucional.
 * Usa a porta atual e o dev base host do env; facilita pular entre áreas.
 */
function DevRootIndex() {
  const devBase = process.env.NEXT_PUBLIC_DEV_BASE_HOST ?? 'lvh.me'
  const port = '3008'
  const tenants = ['barbearia-teste', 'casa-do-corte', 'barba-preta'] as const
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
        label: `Login do salão · ${slug}`,
        url: `http://${host}/salon/login`,
        hint: `${host} · equipe do salão`,
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
      </div>
    </main>
  )
}
