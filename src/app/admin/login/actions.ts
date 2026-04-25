'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { isStaffRole } from '@/lib/auth/roles'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export type LoginState = { error?: string }

export async function loginStaffAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: 'E-mail ou senha inválidos.' }
  }

  const rememberMe = formData.get('rememberMe') === 'on'
  const supabase = await createClient({ sessionOnly: !rememberMe })
  const { data: auth, error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error || !auth.user) {
    return { error: 'Credenciais inválidas.' }
  }

  // Checa se o user pertence à equipe deste tenant. Sem isso o layout
  // autenticado redireciona de volta aqui em loop silencioso.
  const h = await headers()
  const tenantId = h.get('x-ara-tenant-id')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, tenant_id, is_active')
    .eq('user_id', auth.user.id)
    .maybeSingle()

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut()
    return { error: 'Esta conta não tem acesso a este negócio.' }
  }

  if (!isStaffRole(profile.role)) {
    await supabase.auth.signOut()
    return { error: 'Esta conta não é da equipe.' }
  }

  if (tenantId && profile.tenant_id !== tenantId) {
    await supabase.auth.signOut()
    return { error: 'Esta conta é de outro negócio.' }
  }

  redirect('/admin/dashboard')
}
