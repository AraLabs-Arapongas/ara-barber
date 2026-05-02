import { createClient } from '@/lib/supabase/server'

/**
 * Cota de profissionais do tenant baseada no plano vigente.
 *
 * Regra atual: o plano define `included_professionals` (default 10).
 * Cada profissional ATIVO acima desse número custa
 * `extra_professional_price_cents` (default R$ 19,90) por mês.
 *
 * Profissional inativo NÃO conta na cota — desativar libera vaga
 * imediatamente. O staff pode excluir um profissional inativo só se
 * ele não tiver agendamentos no histórico (preserva relatórios).
 */
export type ProfessionalUsage = {
  /** Profissionais com is_active = true */
  activeCount: number
  /** Quantos o plano inclui sem cobrança extra */
  included: number
  /** Profissionais ativos acima do incluído (>= 0) */
  extraCount: number
  /** Preço mensal em centavos por profissional adicional */
  extraUnitPriceCents: number
  /** Total mensal extra em centavos (extraCount * extraUnitPriceCents) */
  extraMonthlyCents: number
  /** Limite "macio": acima disso adicionar gera cobrança extra */
  willExceedOnAdd: boolean
}

export async function getProfessionalUsage(tenantId: string): Promise<ProfessionalUsage> {
  const supabase = await createClient()

  // Lê plano vigente do tenant. Fallback: primeiro plano default ativo.
  const { data: tenant } = await supabase
    .from('tenants')
    .select('current_plan_id')
    .eq('id', tenantId)
    .maybeSingle()

  let planQuery = supabase
    .from('plans')
    .select('included_professionals, extra_professional_price_cents')

  if (tenant?.current_plan_id) {
    planQuery = planQuery.eq('id', tenant.current_plan_id)
  } else {
    planQuery = planQuery.eq('is_default', true).eq('is_active', true)
  }

  const { data: plan } = await planQuery.maybeSingle()

  const included = plan?.included_professionals ?? 10
  const extraUnitPriceCents = plan?.extra_professional_price_cents ?? 1990

  const { count } = await supabase
    .from('professionals')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  const activeCount = count ?? 0
  const extraCount = Math.max(0, activeCount - included)
  const extraMonthlyCents = extraCount * extraUnitPriceCents
  const willExceedOnAdd = activeCount >= included

  return {
    activeCount,
    included,
    extraCount,
    extraUnitPriceCents,
    extraMonthlyCents,
    willExceedOnAdd,
  }
}
