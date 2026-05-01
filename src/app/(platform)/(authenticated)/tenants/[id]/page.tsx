import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { getTenantById } from '@/lib/platform/tenants'
import { formatCentsToBrl } from '@/lib/money'
import { BrandingForm, StatusActions } from './edit-forms'

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tenant = await getTenantById(id)
  if (!tenant) notFound()

  const dateFmt = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/tenants" className="text-[0.8125rem] text-fg-muted hover:text-fg">
        ← Tenants
      </Link>
      <header>
        <h1 className="font-display text-[1.5rem] font-semibold text-fg">{tenant.name}</h1>
        <p className="text-[0.8125rem] text-fg-muted">
          {tenant.slug} ·{' '}
          <a
            href={`https://${tenant.subdomain}.aralabs.com.br`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            {tenant.subdomain}.aralabs.com.br
          </a>
        </p>
      </header>

      <Card>
        <CardContent className="space-y-3 py-4">
          <h2 className="text-[0.75rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
            Status
          </h2>
          <Row label="Status" value={tenant.status} />
          <Row label="Billing" value={tenant.billing_status} />
          <Row label="Mensalidade" value={formatCentsToBrl(tenant.monthly_price_cents ?? 0)} />
          <Row
            label="Trial até"
            value={tenant.trial_ends_at ? dateFmt.format(new Date(tenant.trial_ends_at)) : '—'}
          />
          <Row label="Criado em" value={dateFmt.format(new Date(tenant.created_at))} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-4">
          <h2 className="text-[0.75rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
            Mudar status
          </h2>
          <StatusActions tenantId={tenant.id} current={tenant.status} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-4">
          <h2 className="text-[0.75rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
            Branding
          </h2>
          <Row label="Cor primária" value={tenant.primary_color ?? '—'} />
          <Row label="Cor secundária" value={tenant.secondary_color ?? '—'} />
          <Row label="Cor accent" value={tenant.accent_color ?? '—'} />
          <Row label="Logo" value={tenant.logo_url ?? '—'} />
          <Row label="Favicon" value={tenant.favicon_url ?? '—'} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-4">
          <h2 className="text-[0.75rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
            Editar branding
          </h2>
          <BrandingForm
            tenantId={tenant.id}
            primaryColor={tenant.primary_color}
            secondaryColor={tenant.secondary_color}
            accentColor={tenant.accent_color}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border/50 pb-2 last:border-b-0 last:pb-0">
      <span className="text-[0.8125rem] text-fg-muted">{label}</span>
      <span className="text-[0.875rem] text-fg">{value}</span>
    </div>
  )
}
