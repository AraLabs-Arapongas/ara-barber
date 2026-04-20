import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

type BookingRow = {
  id: string
  start_at: string
  tenant_id: string
  service: { name: string; duration_minutes: number } | null
  professional: { name: string; display_name: string | null } | null
}

export default async function BookSuccess({ searchParams }: PageProps) {
  const tenant = await getCurrentTenantOrNotFound()
  const sp = await searchParams
  const appointmentId =
    typeof sp.appointmentId === 'string' ? sp.appointmentId : Array.isArray(sp.appointmentId) ? sp.appointmentId[0] : ''

  let appt: BookingRow | null = null
  if (appointmentId) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('appointments')
      .select(
        `id, start_at, tenant_id,
         service:services(name, duration_minutes),
         professional:professionals(name, display_name)`,
      )
      .eq('id', appointmentId)
      .maybeSingle()
    appt = (data as unknown as BookingRow | null) ?? null
    if (appt && appt.tenant_id !== tenant.id) appt = null
  }

  const dateTimeLabel = appt
    ? new Intl.DateTimeFormat('pt-BR', {
        timeZone: tenant.timezone,
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(appt.start_at))
    : null

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col items-center px-5 pt-10 pb-24 text-center sm:px-6">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success-bg text-success">
        <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
      </div>
      <h1 className="font-display text-[1.875rem] font-semibold leading-tight tracking-tight text-fg">
        Agendado!
      </h1>
      <p className="mt-2 max-w-sm text-[0.9375rem] text-fg-muted">
        Você vai receber uma confirmação por e-mail. Se precisar reagendar, entre em
        &ldquo;Minhas reservas&rdquo;.
      </p>

      {appt ? (
        <Card className="mt-6 w-full shadow-xs">
          <CardContent className="py-5 text-left">
            <p className="font-display text-[1.125rem] font-semibold text-fg">
              {appt.service?.name ?? 'Serviço'}
            </p>
            <p className="text-[0.875rem] text-fg-muted">
              com {appt.professional?.display_name || appt.professional?.name} ·{' '}
              {dateTimeLabel}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-6 flex w-full flex-col gap-2">
        <Link href="/meus-agendamentos">
          <Button size="lg" fullWidth>
            Ver minhas reservas
          </Button>
        </Link>
        <Link href="/">
          <Button size="lg" variant="secondary" fullWidth>
            Voltar à home
          </Button>
        </Link>
      </div>
    </main>
  )
}
