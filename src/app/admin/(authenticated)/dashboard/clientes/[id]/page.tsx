import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, Phone, Plus } from 'lucide-react'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { InitialsAvatar } from '@/components/ui/initials-avatar'
import { WhatsappIcon } from '@/components/ui/whatsapp-icon'
import { buildTelUrl, buildWhatsappUrl } from '@/lib/contact/whatsapp'
import { STATUS_LABELS, STATUS_TONE } from '@/lib/appointments/labels'
import { formatCentsToBrl } from '@/lib/money'
import type { AppointmentStatus } from '@/lib/appointments/status-rules'

type PageProps = { params: Promise<{ id: string }> }

function displayName(name: string | null, email: string | null): string {
  if (name && name.trim().length > 0) return name
  if (email && email.trim().length > 0) return email
  return '(sem nome)'
}

export default async function ClienteDetailPage({ params }: PageProps) {
  const { id } = await params
  const tenant = await getCurrentTenantOrNotFound()
  const supabase = await createClient()

  const [{ data: customer }, { data: appts }, { data: services }] =
    await Promise.all([
      supabase
        .from('customers')
        .select('id, name, email, phone, created_at')
        .eq('id', id)
        .eq('tenant_id', tenant.id)
        .is('deleted_at', null)
        .maybeSingle(),
      supabase
        .from('appointments')
        .select(
          'id, start_at, status, price_cents_snapshot, service_id, service_name_snapshot',
        )
        .eq('tenant_id', tenant.id)
        .eq('customer_id', id)
        .order('start_at', { ascending: false }),
      supabase
        .from('services')
        .select('id, name, price_cents')
        .eq('tenant_id', tenant.id),
    ])

  if (!customer) notFound()

  const priceById = new Map<string, number>(
    (services ?? []).map((s) => [s.id, s.price_cents]),
  )
  const nameById = new Map<string, string>(
    (services ?? []).map((s) => [s.id, s.name]),
  )

  const all = appts ?? []
  const completed = all.filter((a) => a.status === 'COMPLETED')
  const totalCents = completed.reduce(
    (s, a) =>
      s + (a.price_cents_snapshot ?? priceById.get(a.service_id) ?? 0),
    0,
  )

  const name = displayName(customer.name, customer.email)
  const tel = buildTelUrl(customer.phone)
  const wa = customer.phone
    ? buildWhatsappUrl(customer.phone, `Oi ${name.split(/\s+/)[0]}!`)
    : null

  const dateFmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: tenant.timezone,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <Link
        href="/admin/dashboard/clientes"
        className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] text-fg-muted hover:text-fg"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Clientes
      </Link>

      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Cliente
        </p>
        <div className="mt-1 flex items-center gap-3">
          <InitialsAvatar name={name} size={48} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-[1.5rem] font-semibold leading-tight tracking-tight text-fg">
              {name}
            </h1>
            <p className="truncate text-[0.875rem] text-fg-muted">
              {customer.phone ?? customer.email ?? '(sem contato)'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`WhatsApp para ${name}`}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366] text-white transition-opacity hover:opacity-90"
              >
                <WhatsappIcon className="h-4 w-4" />
              </a>
            ) : null}
            {tel ? (
              <a
                href={tel}
                aria-label={`Ligar para ${name}`}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-subtle text-fg-muted transition-colors hover:bg-border"
              >
                <Phone className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Stat label="Agendamentos" value={String(all.length)} />
        <Stat label="Concluídos" value={String(completed.length)} />
        <Stat label="Total" value={formatCentsToBrl(totalCents)} />
      </div>

      <div className="mb-5">
        <Link
          href={`/admin/dashboard/agenda/novo?customerId=${customer.id}`}
        >
          <Button type="button" fullWidth>
            <Plus className="h-4 w-4" />
            Novo agendamento
          </Button>
        </Link>
      </div>

      <h2 className="mb-2 px-1 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
        Histórico
      </h2>

      {all.length === 0 ? (
        <Card className="shadow-xs">
          <CardContent className="py-10 text-center">
            <p className="text-[0.9375rem] text-fg-muted">
              Esse cliente ainda não tem agendamentos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {all.map((a) => {
            const status = a.status as AppointmentStatus
            const cents =
              a.price_cents_snapshot ?? priceById.get(a.service_id) ?? 0
            const svcName =
              a.service_name_snapshot ??
              nameById.get(a.service_id) ??
              'Serviço'
            return (
              <li key={a.id}>
                <Link href={`/admin/dashboard/agenda/${a.id}`}>
                  <Card className="shadow-xs transition-colors hover:bg-bg-subtle/50">
                    <CardContent className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-fg">
                          {svcName}
                        </p>
                        <p className="text-[0.8125rem] text-fg-muted">
                          {dateFmt.format(new Date(a.start_at))}
                        </p>
                        <p className="mt-1 text-[0.75rem] text-fg-subtle">
                          {formatCentsToBrl(cents)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide ${STATUS_TONE[status]}`}
                      >
                        {STATUS_LABELS[status]}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="shadow-xs">
      <CardContent className="px-3 py-3">
        <p className="text-[0.6875rem] uppercase tracking-wide text-fg-subtle">
          {label}
        </p>
        <p className="font-display text-[1.125rem] font-semibold leading-tight text-fg">
          {value}
        </p>
      </CardContent>
    </Card>
  )
}
