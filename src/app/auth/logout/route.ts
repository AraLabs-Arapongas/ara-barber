import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()

  // Permitir caller indicar onde voltar (ex: staff → /admin/login,
  // customer → /). Restringe a paths relativos pra evitar open redirect.
  const nextParam = request.nextUrl.searchParams.get('next')
  const safeNext = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
    ? nextParam
    : '/'

  // Redirect relativo: o browser resolve contra o origin atual, preservando
  // o subdomínio do tenant (qa-aralabs.aralabs.com.br etc.). Usar absolute aqui
  // volta localhost porque o Next dev normaliza request.url pro host interno.
  return new Response(null, {
    status: 303,
    headers: { Location: safeNext },
  })
}
