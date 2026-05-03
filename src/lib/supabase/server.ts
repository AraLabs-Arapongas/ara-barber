import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

import { resolveCookieDomain } from '@/lib/auth/cookie-domain'

type CreateClientOptions = {
  /**
   * Quando true, remove `maxAge`/`expires` dos cookies de sessão gravados pelo
   * Supabase, transformando em session cookies (morrem ao fechar o browser).
   * Usado quando o usuário desmarca "lembrar-me" no login.
   */
  sessionOnly?: boolean
}

export async function createClient(opts?: CreateClientOptions) {
  const cookieStore = await cookies()
  const headerStore = await headers()
  // SSO entre subdomínios da plataforma: força `domain=.aralabs.com.br`
  // (ou `.lvh.me` em dev) nos cookies sb-* pra que sessão seja compartilhada
  // entre `tenant-a.*` e `tenant-b.*`. Custom domain → undefined → host-only.
  const cookieDomain = resolveCookieDomain(headerStore.get('host'))

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              const finalOptions = {
                ...options,
                ...(opts?.sessionOnly ? { maxAge: undefined, expires: undefined } : {}),
                ...(cookieDomain ? { domain: cookieDomain } : {}),
              }
              cookieStore.set(name, value, finalOptions)
            }
          } catch {
            // Ignorado em contexto de server component (read-only).
            // Necessário em server actions e route handlers.
          }
        },
      },
    },
  )
}
