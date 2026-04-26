import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { BookingRulesForm } from '@/components/dashboard/booking-rules-form'

export default async function RegrasPage() {
  const tenant = await getCurrentTenantOrNotFound()
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Agenda
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Regras de agendamento
        </h1>
        <p className="mt-1 text-[0.875rem] text-fg-muted">
          Como seus clientes podem agendar e cancelar pelo link público.
        </p>
      </header>
      <BookingRulesForm
        initial={{
          min_advance_hours: tenant.minAdvanceHours,
          slot_interval_minutes: tenant.slotIntervalMinutes,
          cancellation_window_hours: tenant.cancellationWindowHours,
          customer_can_cancel: tenant.customerCanCancel,
        }}
      />
    </main>
  )
}
