import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { ClientsList, type ClientItem } from '@/components/dashboard/clients-list'
import { MoneyVisibilityToggle } from '@/components/ui/money-visibility-toggle'

function displayName(name: string | null, email: string | null): string {
  if (name && name.trim().length > 0) return name
  if (email && email.trim().length > 0) return email
  return '(sem nome)'
}

export default async function ClientesPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const supabase = await createClient()

  const [customersRes, apptsRes, servicesRes] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name, email, phone, created_at')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('appointments')
      .select('customer_id, status, price_cents_snapshot, service_id, start_at')
      .eq('tenant_id', tenant.id),
    supabase.from('services').select('id, price_cents').eq('tenant_id', tenant.id),
  ])

  const priceById = new Map<string, number>(
    (servicesRes.data ?? []).map((s) => [s.id, s.price_cents]),
  )

  const stats = new Map<string, { count: number; lastAt: string | null; totalCents: number }>()
  for (const a of apptsRes.data ?? []) {
    if (!a.customer_id) continue
    const cur = stats.get(a.customer_id) ?? {
      count: 0,
      lastAt: null,
      totalCents: 0,
    }
    cur.count += 1
    if (!cur.lastAt || a.start_at > cur.lastAt) cur.lastAt = a.start_at
    if (a.status === 'COMPLETED') {
      const cents = a.price_cents_snapshot ?? priceById.get(a.service_id) ?? 0
      cur.totalCents += cents
    }
    stats.set(a.customer_id, cur)
  }

  const list: ClientItem[] = (customersRes.data ?? []).map((c) => ({
    id: c.id,
    name: displayName(c.name, c.email),
    email: c.email,
    phone: c.phone,
    createdAt: c.created_at,
    appointmentsCount: stats.get(c.id)?.count ?? 0,
    lastAt: stats.get(c.id)?.lastAt ?? null,
    totalCents: stats.get(c.id)?.totalCents ?? 0,
  }))

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
            Base
          </p>
          <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
            Clientes
          </h1>
          <p className="mt-1 text-[0.875rem] text-fg-muted">Quem já agendou no seu negócio.</p>
        </div>
        <MoneyVisibilityToggle className="mt-1" />
      </header>

      <div className="mb-3">
        <Link href="/admin/dashboard/agenda/novo">
          <Button type="button" size="sm">
            <Plus className="h-3.5 w-3.5" />
            Novo agendamento
          </Button>
        </Link>
      </div>

      <ClientsList items={list} tenantTimezone={tenant.timezone} />
    </main>
  )
}
