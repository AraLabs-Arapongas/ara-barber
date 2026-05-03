'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createSecretClient } from '@/lib/supabase/secret'
import { assertStaff, AuthError } from '@/lib/auth/guards'

const StepSchema = z.object({
  step: z.enum(['tour', 'skipped']),
})

export type OnboardingActionResult = { ok: true } | { ok: false; error: string }

/**
 * Persiste a escolha do owner no welcome modal: `tour` (aceitou ser
 * guiado) ou `skipped` (vai explorar sozinho). Modal não aparece de
 * novo depois disso — só o checklist.
 */
export async function setOnboardingStep(
  raw: z.infer<typeof StepSchema>,
): Promise<OnboardingActionResult> {
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

  revalidatePath('/admin/dashboard')
  return { ok: true }
}
