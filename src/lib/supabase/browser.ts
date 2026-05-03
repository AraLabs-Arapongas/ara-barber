'use client'

import { createBrowserClient } from '@supabase/ssr'

import { resolveCookieDomain } from '@/lib/auth/cookie-domain'

export function createClient() {
  // SSO entre subdomínios da plataforma — ver comentário em `server.ts`.
  // No browser, lê do `window.location.hostname`. Em SSR este módulo
  // não roda (use server.ts), então `window` é seguro.
  const domain = resolveCookieDomain(
    typeof window !== 'undefined' ? window.location.hostname : null,
  )

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    domain ? { cookieOptions: { domain } } : undefined,
  )
}
