import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next') ?? '/'
  // Só aceitamos paths relativos (começando com /) — evita open redirect.
  const next = rawNext.startsWith('/') ? rawNext : '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Redirect relativo: o browser resolve contra o origin atual, preservando
      // o subdomínio. Absolute usando request.url volta localhost em dev.
      return new Response(null, {
        status: 302,
        headers: { Location: next },
      })
    }
  }

  return new Response(null, {
    status: 302,
    headers: { Location: '/auth/error' },
  })
}
