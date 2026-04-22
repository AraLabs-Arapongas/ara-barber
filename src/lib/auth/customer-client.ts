'use client'

import { createClient } from '@/lib/supabase/browser'

/**
 * Envia OTP de 6 dígitos por e-mail pro cliente (booking público). Supabase
 * envia também magic link no mesmo e-mail — se o cliente clicar no link, o
 * `/auth/callback` fecha a sessão e redireciona.
 */
export async function sendCustomerOtp(email: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${window.location.origin}/auth/callback?next=/meus-agendamentos`,
    },
  })
  return { error: error?.message ?? null }
}

export async function verifyCustomerOtp(
  email: string,
  token: string,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })
  return { error: error?.message ?? null }
}

export async function signInCustomerGoogle(
  nextPath = '/meus-agendamentos',
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  })
  if (error) {
    return { error: error.message }
  }
  if (!data?.url) {
    return { error: 'Supabase não retornou URL de consent do Google.' }
  }
  window.location.href = data.url
  return { error: null }
}
