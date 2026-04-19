import 'server-only'

import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { createSecretClient } from '@/lib/supabase/secret'
import type { Database } from '@/lib/supabase/types'

export type TenantContext = {
  id: string
  slug: string
  name: string
  timezone: string
  primaryColor: string | null
  secondaryColor: string | null
  accentColor: string | null
  logoUrl: string | null
  faviconUrl: string | null
  status: Database['public']['Enums']['tenant_status']
  billingStatus: Database['public']['Enums']['billing_status']
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
 */
export async function getCurrentTenantOrNotFound(): Promise<TenantContext> {
  const tenantId = await getCurrentTenantId()
  if (!tenantId) notFound()

  const supabase = createSecretClient()
  const { data } = await supabase
    .from('tenants')
    .select(
      'id, slug, name, timezone, primary_color, secondary_color, accent_color, logo_url, favicon_url, status, billing_status',
    )
    .eq('id', tenantId)
    .maybeSingle()

  if (!data) notFound()

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    timezone: data.timezone,
    primaryColor: data.primary_color,
    secondaryColor: data.secondary_color,
    accentColor: data.accent_color,
    logoUrl: data.logo_url,
    faviconUrl: data.favicon_url,
    status: data.status,
    billingStatus: data.billing_status,
  }
}
