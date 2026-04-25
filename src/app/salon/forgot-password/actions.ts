'use server'

import { z } from 'zod'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

const forgotSchema = z.object({
  email: z.string().email(),
})

export type ForgotPasswordState = {
  ok?: boolean
  error?: string
}

export async function forgotPasswordAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = forgotSchema.safeParse({
    email: formData.get('email'),
  })

  if (!parsed.success) {
    return { error: 'E-mail inválido.' }
  }

  const h = await headers()
  const host = h.get('x-ara-host')
  if (!host) {
    // x-ara-host é setado pelo proxy. Ausência em prod = config quebrada
    // ou bypass; recusar pra não enviar email com redirectTo localhost.
    if (process.env.NODE_ENV === 'production') {
      return { error: 'Não foi possível processar. Tente novamente.' }
    }
    // Em dev sem header (acesso direto sem proxy), usa fallback razoável.
  }
  const safeHost = host ?? 'localhost:3008'
  // Inverted check (vs naive `=== 'production' ? https : http`): vitest roda
  // com NODE_ENV='test', queremos https no test runner; só dev usa http.
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
  const redirectTo = `${protocol}://${safeHost}/salon/reset-password`

  const supabase = await createClient()
  // Anti-enumeration: ignoramos o resultado. Sempre retornamos sucesso pra não
  // vazar se o email existe ou não. Supabase rate limita per-email automaticamente.
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo })
  if (error) {
    // Anti-enumeration: erro NÃO retorna pro client (não vaza se email existe).
    // Mas logamos code/status pra observability ops (sem email pra não defeat
    // anti-enumeration via logs).
    console.error('[forgot-password] resetPasswordForEmail failed', {
      code: error.code,
      status: error.status,
    })
  }

  return { ok: true }
}
