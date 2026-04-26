import { getBookingContext } from '@/app/admin/(authenticated)/actions/booking-context'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'

import { ManualBookingWizard } from './wizard'

function todayISO(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function addDays(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function NewAppointmentPage({ searchParams }: PageProps) {
  const tenant = await getCurrentTenantOrNotFound()
  const today = todayISO(tenant.timezone)
  const horizon = addDays(today, 60)

  const ctxResult = await getBookingContext({ from: today, to: horizon })
  if (!ctxResult.ok) {
    throw new Error(ctxResult.error)
  }

  const supabase = await createClient()
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, phone, email')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200)

  const sp = await searchParams
  const initialCustomerId =
    typeof sp.customerId === 'string' && /^[0-9a-f-]{36}$/i.test(sp.customerId)
      ? sp.customerId
      : undefined

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Operação
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Novo agendamento
        </h1>
      </header>
      <ManualBookingWizard
        context={ctxResult.context}
        customers={(customers ?? []).map((c) => ({
          id: c.id,
          name: c.name ?? '',
          phone: c.phone,
          email: c.email,
        }))}
        initialCustomerId={initialCustomerId}
      />
    </main>
  )
}
