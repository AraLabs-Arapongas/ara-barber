import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { getCustomerBookingContext } from '@/lib/booking/customer-context'
import { getCustomerForTenant } from '@/lib/customers/ensure'
import { createClient } from '@/lib/supabase/server'
import { CustomerBookingWizard } from '@/components/book/wizard'

type Step = 'service' | 'order' | 'professional' | 'datetime' | 'confirm'
const VALID_STEPS = new Set<Step>([
  'service',
  'order',
  'professional',
  'datetime',
  'confirm',
])

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function pickString(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null
  return v ?? null
}

function parseCsv(v: string | string[] | undefined): string[] {
  const s = pickString(v)
  if (!s) return []
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

/**
 * Wizard único de booking. Suporta combo (N serviços) e single (1 serviço).
 *
 * URL params (deep-link friendly):
 *   step=service|order|professional|datetime|confirm
 *   serviceIds=<csv>
 *   order=<csv>          (default = serviceIds)
 *   profIds=<csv>        (paralelo a `order`, posicional)
 *   startAt=<ISO>        (slot inicial)
 *
 * Compat: aceita também URL legada `serviceId=X&professionalId=Y` e
 * normaliza pra serviceIds=X&profIds=Y. Vale pra "Reagendar" links
 * antigos.
 */
export default async function BookPage({ searchParams }: PageProps) {
  const tenant = await getCurrentTenantOrNotFound()
  const sp = await searchParams

  const stepParam = pickString(sp.step) as Step | null
  const initialStep = stepParam && VALID_STEPS.has(stepParam) ? stepParam : null

  // Multi-svc preferido; cai pra legado se vazio.
  let serviceIds = parseCsv(sp.serviceIds)
  if (serviceIds.length === 0) {
    const legacy = pickString(sp.serviceId)
    if (legacy) serviceIds = [legacy]
  }
  let order = parseCsv(sp.order)
  if (order.length === 0) order = serviceIds

  // profIds posicional ao order. Se vazio, tenta legado professionalId.
  const profIds = parseCsv(sp.profIds)
  let professionalByService: Record<string, string> = {}
  if (profIds.length > 0) {
    order.forEach((sid, i) => {
      const p = profIds[i]
      if (p) professionalByService[sid] = p
    })
  } else {
    const legacyProf = pickString(sp.professionalId)
    if (legacyProf && order.length === 1) {
      professionalByService = { [order[0]]: legacyProf }
    }
  }

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
        serviceIds,
        order,
        professionalByService,
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
