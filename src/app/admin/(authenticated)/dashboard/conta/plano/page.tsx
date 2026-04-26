import { createSecretClient } from '@/lib/supabase/secret'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { Card, CardContent } from '@/components/ui/card'
import { formatCentsToBrl } from '@/lib/money'

const STATUS_LABELS: Record<string, string> = {
  TRIALING: 'Em trial',
  ACTIVE: 'Ativo',
  PAST_DUE: 'Em atraso',
  CANCELED: 'Cancelado',
}

const SUPPORT_PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? '5543999999999'
const SUPPORT_MESSAGE = 'Olá, preciso de ajuda com plano e cobrança da AraLabs.'

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
}

export default async function PlanoPage() {
  const tenant = await getCurrentTenantOrNotFound()
  // Usa secret client porque os campos de billing não estão expostos pra
  // staff via RLS de leitura na tabela tenants (defense-in-depth do plano).
  const supabase = createSecretClient()

  const { data: tenantBilling } = await supabase
    .from('tenants')
    .select(
      'billing_status, current_plan_id, trial_ends_at, subscription_ends_at, monthly_price_cents',
    )
    .eq('id', tenant.id)
    .maybeSingle()

  const { data: plan } = tenantBilling?.current_plan_id
    ? await supabase
        .from('plans')
        .select('id, name, monthly_price_cents')
        .eq('id', tenantBilling.current_plan_id)
        .maybeSingle()
    : { data: null }

  const billingStatus = tenantBilling?.billing_status ?? tenant.billingStatus
  const trialDays = daysUntil(tenantBilling?.trial_ends_at ?? null)
  const subDays = daysUntil(tenantBilling?.subscription_ends_at ?? null)
  const effectivePriceCents =
    tenantBilling?.monthly_price_cents ?? plan?.monthly_price_cents ?? null

  const supportHref = `https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent(SUPPORT_MESSAGE)}`

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Plano e cobrança
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Sua conta com a AraLabs. Para mudanças de plano ou faturamento, fale com o suporte.
        </p>
      </header>

      <div className="space-y-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-fg-muted">Status</p>
            <p className="font-display text-xl font-semibold text-fg">
              {STATUS_LABELS[billingStatus] ?? billingStatus}
            </p>
            {trialDays !== null && billingStatus === 'TRIALING' ? (
              <p className="mt-1 text-sm text-fg-muted">
                {trialDays > 0
                  ? `${trialDays} ${trialDays === 1 ? 'dia restante' : 'dias restantes'} no trial`
                  : 'Trial expirou'}
              </p>
            ) : null}
            {subDays !== null && billingStatus === 'ACTIVE' ? (
              <p className="mt-1 text-sm text-fg-muted">
                Próxima renovação em {subDays} {subDays === 1 ? 'dia' : 'dias'}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-fg-muted">Plano</p>
            <p className="font-display text-xl font-semibold text-fg">
              {plan?.name ?? 'Sem plano'}
            </p>
            <p className="mt-1 text-sm text-fg-muted">
              {effectivePriceCents !== null
                ? `${formatCentsToBrl(effectivePriceCents)} / mês`
                : '—'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-fg">
              Para alterar plano, atualizar forma de pagamento ou ver histórico de cobranças, entre
              em contato com o suporte da AraLabs.
            </p>
            <a
              href={supportHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex h-11 items-center justify-center rounded-md bg-brand-primary px-5 text-[0.9375rem] font-medium text-brand-primary-fg shadow-sm transition-colors hover:bg-brand-primary-hover"
            >
              Falar com o suporte
            </a>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
