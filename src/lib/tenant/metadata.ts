import type { Metadata } from 'next'
import type { TenantContext } from '@/lib/tenant/context'

/**
 * Constrói metadata Next comum pra páginas tenant-facing: ícones
 * (incluindo apple-touch-icon — essencial pro iOS pegar o logo do
 * tenant ao adicionar à tela inicial), appleWebApp config e title.
 *
 * Passa `overrides` pra customizar description, openGraph, etc.
 */
export function buildTenantMetadata(
  tenant: TenantContext,
  overrides: Partial<Metadata> = {},
): Metadata {
  const appleIcon = tenant.logoUrl ?? tenant.faviconUrl ?? undefined
  const iconHref = tenant.faviconUrl ?? tenant.logoUrl ?? undefined

  return {
    title: tenant.name,
    icons: {
      icon: iconHref,
      apple: appleIcon,
    },
    appleWebApp: {
      title: tenant.name,
      capable: true,
      statusBarStyle: 'default',
    },
    ...overrides,
  }
}
