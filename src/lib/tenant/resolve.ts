import 'server-only'

import { createSecretClient } from '@/lib/supabase/secret'

const APP_BASE_HOST = (process.env.NEXT_PUBLIC_APP_BASE_HOST ?? 'aralabs.com.br').toLowerCase()
const DEV_BASE_HOST = (process.env.NEXT_PUBLIC_DEV_BASE_HOST ?? 'lvh.me').toLowerCase()

/**
 * Subdomínios reservados — não podem virar tenant slug.
 * `admin` pertence ao storefront AraLabs (outro repo). Se chegar aqui, tratamos
 * como `root` (área não gerida por este app).
 */
const RESERVED_SUBDOMAINS = new Set(['admin', 'www', 'api', 'app'])

// Slug: 1-50 chars, lowercase alfanumérico, hífen interno permitido.
const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/

export type ParsedHost = { area: 'tenant'; slug: string } | { area: 'root'; slug: null }

export function parseHostToSlug(host: string): ParsedHost {
  const clean = host.split(':')[0].toLowerCase()

  for (const base of [APP_BASE_HOST, DEV_BASE_HOST]) {
    const suffix = `.${base}`
    if (clean.endsWith(suffix)) {
      const slug = clean.slice(0, -suffix.length)
      if (!SLUG_REGEX.test(slug)) return { area: 'root', slug: null }
      if (RESERVED_SUBDOMAINS.has(slug)) return { area: 'root', slug: null }
      return { area: 'tenant', slug }
    }
  }

  return { area: 'root', slug: null }
}

// Cache in-memory de 60s. Cold start do serverless limpa; aceitável para Fase 1.
type CacheEntry = { id: string | null; expires: number }
const cache = new Map<string, CacheEntry>()
const TTL_MS = 60_000

export async function resolveTenantIdBySlug(slug: string): Promise<string | null> {
  const now = Date.now()
  const cached = cache.get(slug)
  if (cached && cached.expires > now) return cached.id

  const supabase = createSecretClient()
  const { data, error } = await supabase.from('tenants').select('id').eq('slug', slug).maybeSingle()

  if (error) {
    console.error('resolveTenantIdBySlug error', error)
    return null
  }

  const id = data?.id ?? null
  cache.set(slug, { id, expires: now + TTL_MS })
  return id
}

export function __resetTenantResolveCache() {
  cache.clear()
}
