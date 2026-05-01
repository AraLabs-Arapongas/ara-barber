import 'server-only'
import { createSecretClient } from '@/lib/supabase/secret'
import {
  resolveOnboardingState,
  type OnboardingState,
} from '@/lib/onboarding/derivations'

/**
 * Lê o estado do onboarding wizard pra um tenant.
 * Usa secret client porque é chamado do dashboard layout (RSC) onde
 * a sessão já foi validada por assertStaff — bypassa RLS pra evitar
 * roundtrip extra.
 */
export async function getOnboardingState(tenantId: string): Promise<OnboardingState> {
  const supabase = createSecretClient()
  const { data, error } = await supabase
    .from('tenants')
    .select('onboarding_completed_at, onboarding_step')
    .eq('id', tenantId)
    .maybeSingle()
  if (error) throw error
  if (!data) {
    // Tenant não existe — defensivo: retorna como completed pra não loop.
    return { completed: true, currentStep: null, completedSteps: 4 }
  }
  return resolveOnboardingState(data)
}
