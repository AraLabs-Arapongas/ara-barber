'use server'

import { z } from 'zod'

import { assertStaff, AuthError } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

const ChangePasswordInput = z.object({
  newPassword: z
    .string()
    .min(8, 'A senha precisa ter no mínimo 8 caracteres.')
    .max(72, 'A senha pode ter no máximo 72 caracteres.'),
})

export type ChangePasswordInput = z.infer<typeof ChangePasswordInput>

export type ActionResult = { ok: true } | { ok: false; error: string }

/**
 * Altera a senha do usuário autenticado. Operação user-scoped: usa o
 * client server normal (com a sessão do caller), não o secret client.
 */
export async function changeMyPassword(raw: ChangePasswordInput): Promise<ActionResult> {
  try {
    await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
  }

  const parsed = ChangePasswordInput.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Senha inválida.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/**
 * Encerra todas as sessões ativas do usuário (em todos os dispositivos).
 * Após o sucesso, o caller deve redirecionar pra /admin/login.
 */
export async function signOutAllSessions(): Promise<ActionResult> {
  try {
    await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signOut({ scope: 'global' })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
