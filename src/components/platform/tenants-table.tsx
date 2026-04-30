'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import type { AdminTenantRow } from '@/lib/platform/tenants'

const STATUSES = ['ALL', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'] as const
const BILLING = ['ALL', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED'] as const

export function TenantsTable({ tenants }: { tenants: AdminTenantRow[] }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('ALL')
  const [billing, setBilling] = useState<(typeof BILLING)[number]>('ALL')

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return tenants.filter((t) => {
      if (status !== 'ALL' && t.status !== status) return false
      if (billing !== 'ALL' && t.billing_status !== billing) return false
      if (needle && !`${t.name} ${t.slug}`.toLowerCase().includes(needle)) return false
      return true
    })
  }, [tenants, q, status, billing])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar nome ou slug..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <Select label="Status" value={status} onChange={setStatus} options={STATUSES} />
        <Select label="Billing" value={billing} onChange={setBilling} options={BILLING} />
        <span className="ml-auto text-[0.8125rem] text-fg-muted">
          {filtered.length} de {tenants.length}
        </span>
      </div>
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-[0.875rem]">
          <thead className="bg-bg-subtle text-[0.75rem] uppercase tracking-wide text-fg-muted">
            <tr>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-left">Slug</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Billing</th>
              <th className="px-3 py-2 text-left">Plano</th>
              <th className="px-3 py-2 text-left">Trial até</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((t) => (
              <tr key={t.id} className="hover:bg-bg-subtle">
                <td className="px-3 py-2">
                  <Link href={`/tenants/${t.id}`} className="font-medium text-fg hover:underline">
                    {t.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-fg-muted">{t.slug}</td>
                <td className="px-3 py-2">
                  <Badge>{t.status}</Badge>
                </td>
                <td className="px-3 py-2">
                  <Badge tone={t.billing_status === 'PAST_DUE' ? 'danger' : 'default'}>
                    {t.billing_status}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-fg-muted">{t.current_plan_id ?? '—'}</td>
                <td className="px-3 py-2 text-fg-muted">
                  {t.trial_ends_at ? new Date(t.trial_ends_at).toLocaleDateString('pt-BR') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Select<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: ReadonlyArray<T>
}) {
  return (
    <label className="flex items-center gap-2 text-[0.8125rem] text-fg-muted">
      {label}:
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded-md border border-border bg-bg px-2 py-1 text-[0.8125rem] text-fg"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  )
}

function Badge({
  children,
  tone = 'default',
}: {
  children: React.ReactNode
  tone?: 'default' | 'danger'
}) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide ${
        tone === 'danger' ? 'bg-danger/10 text-danger' : 'bg-bg-subtle text-fg'
      }`}
    >
      {children}
    </span>
  )
}
