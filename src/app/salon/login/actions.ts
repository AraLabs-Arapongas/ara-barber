'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export type LoginState = { error?: string }

export async function loginStaffAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: 'E-mail ou senha inválidos.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    return { error: 'Credenciais inválidas.' }
  }

  redirect('/salon/dashboard')
}
