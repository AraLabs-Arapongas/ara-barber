import 'server-only'

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { cache } from 'react'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { createSecretClient } from '@/lib/supabase/secret'
import type { Database } from '@/lib/supabase/types'

/**
 * Resolve um logo "por convenção" a partir do slug:
 * se `public/logos/<slug>.<ext>` existe, devolve o path web.
 * Permite trocar o logo de um tenant só largando o arquivo na pasta,
 * sem precisar mexer no banco.
 */
function resolveConventionalLogoUrl(slug: string): string | null {
  const publicDir = join(process.cwd(), 'public', 'logos')
  for (const ext of ['png', 'svg', 'jpg', 'jpeg', 'webp'] as const) {
    const file = `${slug}.${ext}`
    if (existsSync(join(publicDir, file))) return `/logos/${file}`
  }
  return null
}

export type TenantContext = {
  id: string
  slug: string
  subdomain: string
  name: string
  timezone: string
  primaryColor: string | null
  secondaryColor: string | null
  accentColor: string | null
  logoUrl: string | null
  faviconUrl: string | null
  homeHeadlineTop: string | null
  homeHeadlineAccent: string | null
  status: Database['public']['Enums']['tenant_status']
  billingStatus: Database['public']['Enums']['billing_status']
  cancellationWindowHours: number
}

export async function getCurrentTenantId(): Promise<string | null> {
  const h = await headers()
  const id = h.get('x-ara-tenant-id')
  return id && id.length > 0 ? id : null
}

export async function getCurrentTenantSlug(): Promise<string | null> {
  const h = await headers()
  const slug = h.get('x-ara-tenant-slug')
  return slug && slug.length > 0 ? slug : null
}

export async function getCurrentArea(): Promise<'platform' | 'tenant' | 'root'> {
  const h = await headers()
  const area = h.get('x-ara-area')
  if (area === 'platform' || area === 'tenant') return area
  return 'root'
}

/**
 * Busca o tenant atual via service-role. Anônimos precisam ler branding
 * pra renderizar a landing pública, então não dá pra usar RLS aqui.
 *
 * React.cache() dedupa por request: layout e page compartilham o resultado
 * em vez de refazer o SELECT em cada um.
 */
export const getCurrentTenantOrNotFound = cache(
  async (): Promise<TenantContext> => {
    const tenantId = await getCurrentTenantId()
    if (!tenantId) notFound()

    const supabase = createSecretClient()
    const { data } = await supabase
      .from('tenants')
      .select(
        'id, slug, subdomain, name, timezone, primary_color, secondary_color, accent_color, logo_url, favicon_url, home_headline_top, home_headline_accent, status, billing_status, cancellation_window_hours',
      )
      .eq('id', tenantId)
      .maybeSingle()

    if (!data) notFound()

    return {
      id: data.id,
      slug: data.slug,
      subdomain: data.subdomain,
      name: data.name,
      timezone: data.timezone,
      primaryColor: data.primary_color,
      secondaryColor: data.secondary_color,
      accentColor: data.accent_color,
      logoUrl: data.logo_url ?? resolveConventionalLogoUrl(data.slug),
      faviconUrl: data.favicon_url,
      homeHeadlineTop: data.home_headline_top,
      homeHeadlineAccent: data.home_headline_accent,
      status: data.status,
      billingStatus: data.billing_status,
      cancellationWindowHours: data.cancellation_window_hours ?? 2,
    }
  },
)
