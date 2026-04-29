import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCentsToBrl } from '@/lib/money'

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

type ComboSegmentRow = {
  id: string
  start_at: string
  end_at: string
  position: number | null
  service: { name: string; duration_minutes: number } | null
  professional: { name: string; display_name: string | null } | null
}

function pickString(v: string | string[] | undefined): string {
  return typeof v === 'string' ? v : Array.isArray(v) ? (v[0] ?? '') : ''
}

export default async function BookSuccess({ searchParams }: PageProps) {
  const tenant = await getCurrentTenantOrNotFound()
  const sp = await searchParams
  const appointmentId = pickString(sp.appointmentId)
  const groupId = pickString(sp.groupId)

  // Combo path: lê group + segments.
  if (groupId) {
    const supabase = await createClient()
    const { data: groupData } = await supabase
      .from('appointment_groups')
      .select('id, total_duration_minutes, total_price_cents, tenant_id')
      .eq('id', groupId)
      .maybeSingle()

    if (groupData && groupData.tenant_id === tenant.id) {
      const { data: segments } = await supabase
        .from('appointments')
        .select(
          `id, start_at, end_at, position,
           service:services(name, duration_minutes),
           professional:professionals(name, display_name)`,
        )
        .eq('group_id', groupId)
        .order('position', { ascending: true })

      const segs = (segments as unknown as ComboSegmentRow[] | null) ?? []
      return (
        <SuccessShell title="Combo agendado!">
          {segs.length > 0 ? (
            <Card className="mt-6 w-full shadow-xs">
              <CardContent className="py-5 text-left">
                <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
                  {segs.length} serviços
                </p>
                <ul className="mt-2 space-y-2">
                  {segs.map((seg) => {
                    const startLabel = new Intl.DateTimeFormat('pt-BR', {
                      timeZone: tenant.timezone,
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(new Date(seg.start_at))
                    return (
                      <li key={seg.id} className="flex items-baseline justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-fg">{seg.service?.name ?? 'Serviço'}</p>
                          <p className="text-[0.8125rem] text-fg-muted">
                            com {seg.professional?.display_name ?? seg.professional?.name ?? '—'}
                          </p>
                        </div>
                        <p className="text-[0.875rem] tabular-nums text-fg">{startLabel}</p>
                      </li>
                    )
                  })}
                </ul>
                <p className="mt-3 border-t border-border pt-3 text-[0.8125rem] text-fg-muted">
                  Total · {groupData.total_duration_minutes} min ·{' '}
                  {formatCentsToBrl(groupData.total_price_cents)}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </SuccessShell>
      )
    }
  }

  // Single path (fallback): lê appointment direto.
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
    <SuccessShell title="Agendado!">
      {appt ? (
        <Card className="mt-6 w-full shadow-xs">
          <CardContent className="py-5 text-left">
            <p className="font-display text-[1.125rem] font-semibold text-fg">
              {appt.service?.name ?? 'Serviço'}
            </p>
            <p className="text-[0.875rem] text-fg-muted">
              com {appt.professional?.display_name || appt.professional?.name} · {dateTimeLabel}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </SuccessShell>
  )
}

function SuccessShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col items-center px-5 pt-10 pb-24 text-center sm:px-6">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success-bg text-success">
        <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
      </div>
      <h1 className="font-display text-[1.875rem] font-semibold leading-tight tracking-tight text-fg">
        {title}
      </h1>
      <p className="mt-2 max-w-sm text-[0.9375rem] text-fg-muted">
        Você vai receber uma confirmação por e-mail. Se precisar reagendar, entre em &ldquo;Minhas
        reservas&rdquo;.
      </p>

      {children}

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
