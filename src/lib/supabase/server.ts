import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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
              const finalOptions = opts?.sessionOnly
                ? { ...options, maxAge: undefined, expires: undefined }
                : options
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
