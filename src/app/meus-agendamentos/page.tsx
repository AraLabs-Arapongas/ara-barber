import Link from 'next/link'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createClient } from '@/lib/supabase/server'
import { getMyCustomerAppointments } from '@/lib/appointments/queries'
import { getCustomerForTenant } from '@/lib/customers/ensure'
import { MyAppointmentsList } from '@/components/appointments/my-appointments-list'
import { Card, CardContent } from '@/components/ui/card'

export default async function MeusAgendamentosPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="mx-auto w-full max-w-xl px-5 pt-8 pb-16 sm:px-6">
        <Card className="shadow-xs">
          <CardContent className="py-10 text-center">
            <p className="text-[0.9375rem] text-fg-muted">
              Entre pra ver suas reservas.
            </p>
            <Link
              href="/book/login"
              className="mt-4 inline-block text-[0.875rem] font-medium text-brand-primary hover:underline"
            >
              Fazer login
            </Link>
          </CardContent>
        </Card>
      </main>
    )
  }

  const customer = await getCustomerForTenant(tenant.id)
  const appointments = customer ? await getMyCustomerAppointments(tenant.id) : []
  const tenantRowResult = await supabase
    .from('tenants')
    .select('cancellation_window_hours')
    .eq('id', tenant.id)
    .maybeSingle()
  const cancellationWindowHours = tenantRowResult.data?.cancellation_window_hours ?? 2

  return (
    <MyAppointmentsList
      appointments={appointments}
      tenantTimezone={tenant.timezone}
      cancellationWindowHours={cancellationWindowHours}
    />
  )
}
