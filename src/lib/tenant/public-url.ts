import 'server-only'
import { headers } from 'next/headers'
import type { TenantContext } from './context'

/**
 * Builds the public-facing URL of the tenant's storefront.
 * In production (`*.aralabs.com.br`), uses https.
 * In dev (`*.lvh.me:port`), uses http and respects the dev port.
 * Falls back to `https://<slug>.aralabs.com.br` if headers unavailable.
 */
export async function getTenantPublicUrl(
  tenant: Pick<TenantContext, 'slug' | 'subdomain'>,
): Promise<string> {
  const h = await headers()
  const host = h.get('host')
  if (host) {
    const proto = h.get('x-forwarded-proto') ?? (host.includes('lvh.me') ? 'http' : 'https')
    return `${proto}://${host}`
  }
  return `https://${tenant.subdomain}.aralabs.com.br`
}

/**
 * URL pra compartilhar com clientes que vai DIRETO no wizard de booking,
 * pulando a home pública. Usar quando o intent é "link pra cliente agendar"
 * (ex: empty state da agenda, quick action "Copiar link", tela Link de
 * agendamento, template WhatsApp SHARE_LINK). Pra "página pública do negócio"
 * (presença digital), usar `getTenantPublicUrl`.
 */
export async function getTenantBookingUrl(
  tenant: Pick<TenantContext, 'slug' | 'subdomain'>,
): Promise<string> {
  return `${await getTenantPublicUrl(tenant)}/book`
}
