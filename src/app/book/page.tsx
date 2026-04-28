import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { getCustomerBookingContext } from '@/lib/booking/customer-context'
import { getCustomerForTenant } from '@/lib/customers/ensure'
import { createClient } from '@/lib/supabase/server'
import { CustomerBookingWizard } from '@/components/book/wizard'

type Step = 'service' | 'professional' | 'datetime' | 'confirm'
const VALID_STEPS = new Set<Step>(['service', 'professional', 'datetime', 'confirm'])

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function pickString(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null
  return v ?? null
}

/**
 * Wizard único de booking. Substitui o multi-route antigo
 * (`/book/{servico,profissional,data,horario,login,confirmar}`).
 *
 * Dados de contexto (services, professionals, blocks, appointments do
 * range) são fetched aqui no server e passados de uma vez pro wizard
 * client-side. URL search params (`step`, `serviceId`, `professionalId`,
 * `startAt`) preservam estado em deep-link/back/forward.
 */
export default async function BookPage({ searchParams }: PageProps) {
  const tenant = await getCurrentTenantOrNotFound()
  const sp = await searchParams

  const stepParam = pickString(sp.step) as Step | null
  const initialStep = stepParam && VALID_STEPS.has(stepParam) ? stepParam : null

  const [context, customer, supabase] = await Promise.all([
    getCustomerBookingContext(tenant),
    getCustomerForTenant(tenant.id),
    createClient(),
  ])
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <CustomerBookingWizard
      context={context}
      initial={{
        step: initialStep,
        serviceId: pickString(sp.serviceId),
        professionalId: pickString(sp.professionalId),
        startAtISO: pickString(sp.startAt),
      }}
      initialCustomer={
        customer
          ? {
              id: customer.id,
              name: customer.name,
              phone: customer.phone,
              email: customer.email,
            }
          : null
      }
      isAuthenticated={Boolean(user)}
    />
  )
}
