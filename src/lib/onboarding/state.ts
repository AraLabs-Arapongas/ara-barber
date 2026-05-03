import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { createSecretClient } from '@/lib/supabase/secret'

export type OnboardingItem = {
  key: 'hours' | 'services' | 'professionals' | 'links' | 'public_link'
  label: string
  done: boolean
  href: string
}

export type OnboardingState = {
  /** NULL = nunca viu modal · 'tour' = aceitou wizard · 'skipped' = pulou */
  step: string | null
  /** Quando o owner concluiu (ou marcou skipou tudo). NULL = ainda incompleto. */
  completedAt: string | null
  items: OnboardingItem[]
  doneCount: number
  totalCount: number
  /** True quando todos os items são `done`. */
  allDone: boolean
}

/**
 * Calcula o estado atual de onboarding do tenant.
 *
 * - Conta serviços/profissionais ativos, vínculos, dias de horário aberto.
 * - "public_link" é considerado feito quando algum agendamento já foi criado
 *   ou quando o owner explicitamente marca como "compartilhei" (futuro). Pra
 *   v1, marca true se já existe pelo menos 1 customer (proxy de "alguém usou
 *   o link"). Senão fica como CTA "Copie e compartilhe seu link".
 *
 * Auto-completion: quando `allDone` vira true E `completedAt` ainda é null,
 * o caller (ex: home page) deve chamar `markOnboardingCompleted()` pra
 * persistir e sumir o checklist.
 */
export async function getOnboardingState(tenantId: string): Promise<OnboardingState> {
  const supabase = await createClient()

  const [tenantRes, hoursRes, servicesRes, profsRes, linksRes, customersRes] = await Promise.all([
    supabase
      .from('tenants')
      .select('onboarding_step, onboarding_completed_at')
      .eq('id', tenantId)
      .maybeSingle(),
    supabase
      .from('business_hours')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_open', true),
    supabase
      .from('services')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_active', true),
    supabase
      .from('professionals')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_active', true),
    supabase
      .from('professional_services')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
    supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_active', true),
  ])

  const items: OnboardingItem[] = [
    {
      key: 'hours',
      label: 'Horários de funcionamento',
      done: (hoursRes.count ?? 0) > 0,
      href: '/admin/dashboard/mais',
    },
    {
      key: 'services',
      label: 'Serviços que oferece',
      done: (servicesRes.count ?? 0) > 0,
      href: '/admin/dashboard/servicos',
    },
    {
      key: 'professionals',
      label: 'Profissionais que atendem',
      done: (profsRes.count ?? 0) > 0,
      href: '/admin/dashboard/profissionais',
    },
    {
      key: 'links',
      label: 'Vínculos profissional × serviço',
      done: (linksRes.count ?? 0) > 0,
      href: '/admin/dashboard/equipe-servicos',
    },
    {
      key: 'public_link',
      label: 'Primeiro cliente cadastrado',
      done: (customersRes.count ?? 0) > 0,
      href: '/admin/dashboard/clientes',
    },
  ]

  const doneCount = items.filter((i) => i.done).length
  const totalCount = items.length
  const allDone = doneCount === totalCount

  return {
    step: tenantRes.data?.onboarding_step ?? null,
    completedAt: tenantRes.data?.onboarding_completed_at ?? null,
    items,
    doneCount,
    totalCount,
    allDone,
  }
}

/**
 * Marca onboarding como concluído (auto ou manual). Idempotente — se já
 * tiver `completedAt`, no-op. Usa secret client porque pode rodar como
 * efeito colateral de auto-completion (sem RLS dependendo de role).
 */
export async function markOnboardingCompleted(tenantId: string): Promise<void> {
  const supabase = createSecretClient()
  await supabase
    .from('tenants')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', tenantId)
    .is('onboarding_completed_at', null)
}
