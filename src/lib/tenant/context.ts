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
  /** Aderiu até 31/07/2026 — exibe selo de Pioneiro permanente. */
  isPioneer: boolean
  pioneerSince: string | null
  cancellationWindowMinutes: number
  minAdvanceMinutes: number
  slotIntervalMinutes: number
  customerCanCancel: boolean
  bookingWindowDays: number
  comboBufferMinutes: number
  contactPhone: string | null
  whatsapp: string | null
  /** Tagline/subtítulo curto exibido sob o nome no header (ex: "Centro de beleza"). */
  tagline: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  heroEyebrow: string | null
  heroImageUrl: string | null
  heroImageUrlDesktop: string | null
  heroSubheadline: string | null
  instagramUrl: string | null
  facebookUrl: string | null
  tiktokUrl: string | null
  differentials: Array<{ icon?: string; title: string; text: string }> | null
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
export const getCurrentTenantOrNotFound = cache(async (): Promise<TenantContext> => {
  const tenantId = await getCurrentTenantId()
  if (!tenantId) notFound()

  const supabase = createSecretClient()
  const { data } = await supabase
    .from('tenants')
    .select(
      'id, slug, subdomain, name, timezone, primary_color, secondary_color, accent_color, logo_url, favicon_url, home_headline_top, home_headline_accent, status, billing_status, cancellation_window_minutes, min_advance_minutes, slot_interval_minutes, customer_can_cancel, booking_window_days, contact_phone, whatsapp, address_line1, address_line2, city, state, postal_code, combo_buffer_minutes, hero_eyebrow, hero_image_url, hero_image_url_desktop, hero_subheadline, instagram_url, facebook_url, tiktok_url, differentials, is_pioneer, pioneer_since',
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
    isPioneer: data.is_pioneer ?? false,
    pioneerSince: data.pioneer_since,
    cancellationWindowMinutes: data.cancellation_window_minutes ?? 2,
    minAdvanceMinutes: data.min_advance_minutes ?? 0,
    slotIntervalMinutes: data.slot_interval_minutes ?? 15,
    customerCanCancel: data.customer_can_cancel ?? true,
    bookingWindowDays: data.booking_window_days ?? 14,
    comboBufferMinutes: data.combo_buffer_minutes ?? 10,
    contactPhone: data.contact_phone,
    whatsapp: data.whatsapp,
    // Tagline reusa `home_headline_accent` por enquanto. Não tem campo
    // dedicado no schema; quando precisarmos de duas coisas distintas
    // (headline hero + tagline header), criar `tagline` em tenants.
    tagline: data.home_headline_accent,
    addressLine1: data.address_line1,
    addressLine2: data.address_line2,
    city: data.city,
    state: data.state,
    postalCode: data.postal_code,
    heroEyebrow: data.hero_eyebrow,
    heroImageUrl: data.hero_image_url,
    heroImageUrlDesktop: data.hero_image_url_desktop,
    heroSubheadline: data.hero_subheadline,
    instagramUrl: data.instagram_url,
    facebookUrl: data.facebook_url,
    tiktokUrl: data.tiktok_url,
    differentials: parseDifferentials(data.differentials),
  }
})

function parseDifferentials(
  raw: unknown,
): Array<{ icon?: string; title: string; text: string }> | null {
  if (!Array.isArray(raw)) return null
  const out: Array<{ icon?: string; title: string; text: string }> = []
  for (const item of raw) {
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>
      const title = typeof obj.title === 'string' ? obj.title : ''
      const text = typeof obj.text === 'string' ? obj.text : ''
      if (!title && !text) continue
      const icon = typeof obj.icon === 'string' ? obj.icon : undefined
      out.push({ icon, title, text })
    }
  }
  return out.length > 0 ? out : null
}
