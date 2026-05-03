'use server'

import { z } from 'zod'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createSecretClient } from '@/lib/supabase/secret'
import { assertStaff, AuthError } from '@/lib/auth/guards'

const StepSchema = z.object({
  step: z.enum(['tour', 'skipped']),
})

export type OnboardingStepResult = { ok: true } | { ok: false; error: string }

/**
 * Persiste a escolha do owner no welcome modal:
 * - `tour`: salva `onboarding_step='tour'` no DB. Layout deixa passar
 *   pro setup automático.
 * - `skipped`: salva `onboarding_step='skipped'` E grava cookie
 *   `ara_setup_dismissed=1` (1 ano). DB é fonte de verdade global,
 *   cookie é fast-path no layout pra evitar query extra a cada nav.
 *
 * Modal não aparece de novo depois de qualquer escolha; banner
 * persistente no topo continua mostrando o progresso até completar.
 */
export async function setOnboardingStep(
  raw: z.infer<typeof StepSchema>,
): Promise<OnboardingStepResult> {
  const parsed = StepSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Input inválido' }

  let user
  try {
    user = await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
  }
  const tenantId = user.profile.tenantId
  if (!tenantId) return { ok: false, error: 'Sem tenant.' }

  const supabase = createSecretClient()
  const { error } = await supabase
    .from('tenants')
    .update({ onboarding_step: parsed.data.step })
    .eq('id', tenantId)

  if (error) return { ok: false, error: 'Falha ao salvar.' }

  if (parsed.data.step === 'skipped') {
    const cookieStore = await cookies()
    cookieStore.set('ara_setup_dismissed', '1', {
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      path: '/',
    })
  }

  revalidatePath('/admin/dashboard')
  return { ok: true }
}
