import type { Metadata } from 'next'
import type { TenantContext } from '@/lib/tenant/context'

/**
 * Constrói metadata Next comum pra páginas tenant-facing: ícones
 * (incluindo apple-touch-icon — essencial pro iOS pegar o logo do
 * tenant ao adicionar à tela inicial), appleWebApp config e title.
 *
 * Quando o tenant não tem logo/favicon customizado, NÃO seta `icons`
 * no metadata — assim o Next cai no `app/icon.svg` + `app/apple-icon.svg`
 * (file convention) com a marca AraLabs default.
 *
 * Idem pra `openGraph.images`: tenant custom logo vira preview no WhatsApp;
 * sem custom, cai no `app/opengraph-image.tsx` (PNG dinâmico AraLabs-branded).
 *
 * Passa `overrides` pra customizar description, etc.
 */
export function buildTenantMetadata(
  tenant: TenantContext,
  overrides: Partial<Metadata> = {},
): Metadata {
  const appleIcon = tenant.logoUrl ?? tenant.faviconUrl ?? null
  const iconHref = tenant.faviconUrl ?? tenant.logoUrl ?? null

  const icons = iconHref || appleIcon
    ? {
        ...(iconHref ? { icon: iconHref } : {}),
        ...(appleIcon ? { apple: appleIcon } : {}),
      }
    : undefined

  const ogImages = tenant.logoUrl ? [{ url: tenant.logoUrl }] : undefined

  return {
    title: tenant.name,
    ...(icons ? { icons } : {}),
    ...(ogImages ? { openGraph: { title: tenant.name, images: ogImages } } : {}),
    appleWebApp: {
      title: tenant.name,
      capable: true,
      statusBarStyle: 'default',
    },
    ...overrides,
  }
}
