import 'server-only'

import { createSecretClient } from '@/lib/supabase/secret'

const APP_BASE_HOST = (process.env.NEXT_PUBLIC_APP_BASE_HOST ?? 'aralabs.com.br').toLowerCase()
const DEV_BASE_HOST = (process.env.NEXT_PUBLIC_DEV_BASE_HOST ?? 'lvh.me').toLowerCase()

/**
 * Subdomínios reservados — não podem virar tenant slug.
 */
const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'app'])

const PLATFORM_SUBDOMAIN = 'admin'

// Slug: 1-50 chars, lowercase alfanumérico, hífen interno permitido.
const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/

export type ParsedHost =
  | { area: 'tenant'; slug: string }
  | { area: 'platform'; slug: null }
  | { area: 'root'; slug: null }

export function parseHostToSlug(host: string): ParsedHost {
  const clean = host.split(':')[0].toLowerCase()

  for (const base of [APP_BASE_HOST, DEV_BASE_HOST]) {
    const suffix = `.${base}`
    if (clean.endsWith(suffix)) {
      const slug = clean.slice(0, -suffix.length)
      if (slug === PLATFORM_SUBDOMAIN) return { area: 'platform', slug: null }
      if (!SLUG_REGEX.test(slug)) return { area: 'root', slug: null }
      if (RESERVED_SUBDOMAINS.has(slug)) return { area: 'root', slug: null }
      return { area: 'tenant', slug }
    }
  }

  return { area: 'root', slug: null }
}

/**
 * Cache em memória apenas para resultados POSITIVOS (tenant existe).
 *
 * Histórico: a versão anterior cacheava null por 60s, o que causava
 * 404 fantasma por 1 minuto se um único fetch falhasse (cold start,
 * race no boot, blip de rede). Como dev server e proxy reusam o
 * mesmo processo, qualquer null cacheado virava sticky.
 *
 * Decisão: nunca cacheia null. Misses pagam 1 query por request,
 * mas 404 é raro e evita o pior bug (perder acesso ao próprio
 * tenant até reiniciar). Erros são logados mas NÃO viram cache.
 */
type CacheEntry = { id: string; expires: number }
const cache = new Map<string, CacheEntry>()
const TTL_MS = 60_000

export async function resolveTenantIdBySlug(slug: string): Promise<string | null> {
  const now = Date.now()
  const cached = cache.get(slug)
  if (cached && cached.expires > now) return cached.id

  const supabase = createSecretClient()
  const { data, error } = await supabase.from('tenants').select('id').eq('slug', slug).maybeSingle()

  if (error) {
    // Erro de rede/permissão: log e retorna null SEM cachear. Próximo
    // request retenta imediatamente em vez de ficar 60s preso.
    console.error('resolveTenantIdBySlug error', { slug, error })
    return null
  }

  const id = data?.id ?? null
  if (id) {
    cache.set(slug, { id, expires: now + TTL_MS })
  } else {
    // Tenant não existe: limpa qualquer entrada stale e NÃO cacheia.
    cache.delete(slug)
  }
  return id
}

export function __resetTenantResolveCache() {
  cache.clear()
}
