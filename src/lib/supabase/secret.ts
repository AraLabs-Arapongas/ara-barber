import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente com SECRET KEY (antigo service_role) — ignora RLS.
 * Uso apenas em jobs, webhooks, leituras públicas intencionais ou operações
 * administrativas. Nunca no cliente, nunca exposto via API.
 */
export function createSecretClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
