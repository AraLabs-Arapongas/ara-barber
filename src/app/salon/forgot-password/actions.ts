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
  const host = h.get('x-ara-host') ?? 'localhost'
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
  const redirectTo = `${protocol}://${host}/salon/reset-password`

  const supabase = await createClient()
  // Anti-enumeration: ignoramos o resultado. Sempre retornamos sucesso pra não
  // vazar se o email existe ou não. Supabase rate limita per-email automaticamente.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo })

  return { ok: true }
}
