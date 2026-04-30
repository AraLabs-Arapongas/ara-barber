import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { listAllTenants } from '@/lib/platform/tenants'
import {
  calculateMRR,
  countByStatus,
  filterTrialsExpiringWithinDays,
} from '@/lib/platform/derivations'
import { formatCentsToBrl } from '@/lib/money'

export default async function PlatformDashboard() {
  const tenants = await listAllTenants()
  const mrr = calculateMRR(tenants)
  const byStatus = countByStatus(tenants)
  const trialing = tenants.filter((t) => t.billing_status === 'TRIALING').length
  const expiringTrials = filterTrialsExpiringWithinDays(tenants, 7)

  const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-display text-[1.5rem] font-semibold text-fg">Dashboard</h1>
        <p className="mt-1 text-[0.875rem] text-fg-muted">Visão geral da plataforma.</p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Tenants" value={String(tenants.length)} hint={`${byStatus.ACTIVE} ativos`} />
        <Stat label="MRR estimado" value={formatCentsToBrl(mrr)} hint="billing ACTIVE" />
        <Stat label="Em trial" value={String(trialing)} hint="billing TRIALING" />
        <Stat
          label="Trials vencendo 7d"
          value={String(expiringTrials.length)}
          hint={expiringTrials.length === 0 ? 'tudo em dia' : 'ação requerida'}
          tone={expiringTrials.length > 0 ? 'warning' : 'default'}
        />
      </div>

      {expiringTrials.length > 0 ? (
        <section>
          <h2 className="mb-2 text-[0.75rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
            Trials vencendo nos próximos 7 dias
          </h2>
          <Card>
            <ul className="divide-y divide-border">
              {expiringTrials.map((t) => (
                <li key={t.id} className="flex items-center justify-between px-4 py-3">
                  <Link href={`/tenants/${t.id}`} className="flex-1 hover:underline">
                    <p className="font-medium text-fg">{t.name}</p>
                    <p className="text-[0.8125rem] text-fg-muted">
                      {t.slug} ·{' '}
                      {t.trial_ends_at
                        ? `vence em ${dateFmt.format(new Date(t.trial_ends_at))}`
                        : '—'}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: string
  hint: string
  tone?: 'default' | 'warning'
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
          {label}
        </p>
        <p
          className={`mt-2 font-display text-[1.5rem] font-semibold ${tone === 'warning' ? 'text-warning' : 'text-fg'}`}
        >
          {value}
        </p>
        <p className="text-[0.75rem] text-fg-muted">{hint}</p>
      </CardContent>
    </Card>
  )
}
