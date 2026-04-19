import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(_request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  // Redirect relativo: o browser resolve contra o origin atual, preservando
  // o subdomínio do tenant (barbearia-teste.lvh.me etc.). Usar absolute aqui
  // volta localhost porque o Next dev normaliza request.url pro host interno.
  return new Response(null, {
    status: 303,
    headers: { Location: '/' },
  })
}
