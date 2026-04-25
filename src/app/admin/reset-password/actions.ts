'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const resetSchema = z
  .object({
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'Senhas não conferem',
    path: ['confirm'],
  })

export type ResetPasswordState = {
  error?: string
}

/**
 * Traduz códigos conhecidos do Supabase Auth pra mensagens em PT-BR.
 * Códigos não mapeados caem na message original do Supabase (que pode
 * estar em inglês mas é melhor que mensagem genérica). Se message for
 * vazia, fallback genérico final.
 */
function translateAuthError(code: string | undefined, message: string): string {
  switch (code) {
    case 'weak_password':
      return 'Senha muito fraca. Escolhe uma senha mais forte (evita senhas que apareceram em vazamentos conhecidos).'
    case 'same_password':
      return 'A nova senha precisa ser diferente da atual.'
    case 'session_not_found':
    case 'auth_session_missing':
      return 'Sessão de recuperação expirou. Solicite um novo email em "Esqueci a senha".'
    default:
      return message || 'Erro ao atualizar senha. Tente novamente.'
  }
}

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = resetSchema.safeParse({
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  })

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return { error: firstIssue?.message ?? 'Dados inválidos.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })

  if (error) {
    console.error('[reset-password] updateUser failed', {
      code: error.code,
      status: error.status,
    })
    return { error: translateAuthError(error.code, error.message) }
  }

  redirect('/admin/dashboard')
}
