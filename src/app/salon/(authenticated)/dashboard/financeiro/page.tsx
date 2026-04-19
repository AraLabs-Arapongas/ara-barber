'use client'

import Link from 'next/link'
import { ChevronLeft, Wallet, Receipt, Info } from 'lucide-react'
import { useTenantSlug } from '@/components/mock/tenant-slug-provider'
import { useMockStore } from '@/lib/mock/store'
import { ENTITY } from '@/lib/mock/entities'
import { Card, CardContent } from '@/components/ui/card'
import { formatCentsToBrl } from '@/lib/money'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateOnly(s: string): string {
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1)
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export default function FinanceiroPage() {
  const tenantSlug = useTenantSlug()
  const { data: payouts } = useMockStore(
    tenantSlug,
    ENTITY.payouts.key,
    ENTITY.payouts.schema,
    ENTITY.payouts.seed,
  )

  const pending = payouts.find((p) => p.status === 'PENDING')
  const paid = payouts
    .filter((p) => p.status === 'PAID')
    .sort((a, b) => new Date(b.periodEnd).getTime() - new Date(a.periodEnd).getTime())

  const totalReceived = paid.reduce((s, p) => s + p.netCents, 0)

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <Link
        href="/salon/dashboard/mais"
        className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] text-fg-muted hover:text-fg"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Voltar
      </Link>

      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Operação
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Financeiro
        </h1>
        <p className="mt-1 text-[0.875rem] text-fg-muted">
          A AraLabs recebe pelo app, retém a taxa e repassa pra você em ciclos.
        </p>
      </header>

      {pending ? (
        <Card className="mb-4 overflow-hidden">
          <div className="bg-brand-primary/10 px-5 py-2.5 text-[0.75rem] font-medium uppercase tracking-[0.14em] text-brand-primary">
            Ciclo atual
          </div>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                <Wallet className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.75rem] text-fg-muted">A receber</p>
                <p className="font-display text-[1.875rem] font-semibold leading-none tracking-tight text-fg">
                  {formatCentsToBrl(pending.netCents)}
                </p>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-bg-subtle px-2 py-2.5">
                <dt className="text-[0.6875rem] uppercase tracking-wide text-fg-subtle">Bruto</dt>
                <dd className="mt-0.5 font-medium text-fg">
                  {formatCentsToBrl(pending.grossCents)}
                </dd>
              </div>
              <div className="rounded-lg bg-bg-subtle px-2 py-2.5">
                <dt className="text-[0.6875rem] uppercase tracking-wide text-fg-subtle">Taxa</dt>
                <dd className="mt-0.5 font-medium text-fg">
                  −{formatCentsToBrl(pending.feeCents)}
                </dd>
              </div>
              <div className="rounded-lg bg-bg-subtle px-2 py-2.5">
                <dt className="text-[0.6875rem] uppercase tracking-wide text-fg-subtle">Período</dt>
                <dd className="mt-0.5 font-medium text-fg">
                  {formatDateOnly(pending.periodStart)}–{formatDateOnly(pending.periodEnd)}
                </dd>
              </div>
            </dl>
            <p className="mt-3 flex items-start gap-2 text-[0.8125rem] text-fg-muted">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-subtle" aria-hidden="true" />
              Repasse automático via PIX no fechamento do ciclo.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <h2 className="mt-6 mb-2 px-1 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
        Histórico
      </h2>

      {paid.length > 0 ? (
        <Card className="shadow-xs">
          <ul className="divide-y divide-border">
            {paid.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success-bg text-success">
                  <Receipt className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-fg">
                    {formatCentsToBrl(p.netCents)}
                  </p>
                  <p className="truncate text-[0.8125rem] text-fg-muted">
                    {formatDateOnly(p.periodStart)}–{formatDateOnly(p.periodEnd)} · pago em{' '}
                    {formatDate(p.paidAt)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-success-bg px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide text-success">
                  Pago
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card className="shadow-xs">
          <CardContent className="py-8 text-center">
            <p className="text-[0.9375rem] text-fg-muted">
              Nenhum repasse ainda. Aparece aqui no primeiro fechamento.
            </p>
          </CardContent>
        </Card>
      )}

      {paid.length > 0 ? (
        <p className="mt-4 text-center text-[0.8125rem] text-fg-muted">
          Total recebido: <strong className="text-fg">{formatCentsToBrl(totalReceived)}</strong>
        </p>
      ) : null}
    </main>
  )
}
