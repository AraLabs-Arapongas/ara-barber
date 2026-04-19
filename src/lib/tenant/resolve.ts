import 'server-only'

import { createSecretClient } from '@/lib/supabase/secret'

const PLATFORM_HOST = (
  process.env.NEXT_PUBLIC_PLATFORM_HOST ?? 'admin.aralabs.com.br'
).toLowerCase()
const APP_BASE_HOST = (process.env.NEXT_PUBLIC_APP_BASE_HOST ?? 'aralabs.com.br').toLowerCase()
const DEV_BASE_HOST = (process.env.NEXT_PUBLIC_DEV_BASE_HOST ?? 'lvh.me').toLowerCase()

// Slug: 1-50 chars, lowercase alfanumérico, hífen interno permitido.
// Mesma regex do constraint em 0003_tenants.sql, mas aceita tamanho 1 aqui
// (o DB permite 3+, mas o parsing é neutro e deixa o resolver retornar null se não encontrar).
const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/

export type ParsedHost =
  | { area: 'platform'; slug: null }
  | { area: 'tenant'; slug: string }
  | { area: 'root'; slug: null }

export function parseHostToSlug(host: string): ParsedHost {
  const clean = host.split(':')[0].toLowerCase()
  if (clean === PLATFORM_HOST) return { area: 'platform', slug: null }

  for (const base of [APP_BASE_HOST, DEV_BASE_HOST]) {
    const suffix = `.${base}`
    if (clean.endsWith(suffix)) {
      const slug = clean.slice(0, -suffix.length)
      if (!SLUG_REGEX.test(slug)) return { area: 'root', slug: null }
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
