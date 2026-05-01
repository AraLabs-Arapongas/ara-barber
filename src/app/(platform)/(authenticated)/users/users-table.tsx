'use client'

import { useMemo, useState, useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { deactivateUserAction, sendPasswordResetAction, type UserActionState } from '../actions'
import type { AdminUserRow } from '@/lib/platform/users'

export function UsersTable({ users }: { users: AdminUserRow[] }) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return users
    return users.filter((u) =>
      `${u.name} ${u.email ?? ''} ${u.tenant_name ?? ''}`.toLowerCase().includes(needle),
    )
  }, [users, q])
  return (
    <div className="space-y-3">
      <Input
        placeholder="Buscar nome / email / tenant..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-xs"
      />
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-[0.875rem]">
          <thead className="bg-bg-subtle text-[0.75rem] uppercase tracking-wide text-fg-muted">
            <tr>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Role</th>
              <th className="px-3 py-2 text-left">Tenant</th>
              <th className="px-3 py-2 text-left">Ativo</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((u) => (
              <Row key={u.id} u={u} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Row({ u }: { u: AdminUserRow }) {
  const [resetState, resetAction, resetPending] = useActionState<UserActionState, FormData>(
    sendPasswordResetAction,
    {},
  )
  const [deactState, deactAction, deactPending] = useActionState<UserActionState, FormData>(
    deactivateUserAction,
    {},
  )
  return (
    <tr className={u.is_active ? '' : 'opacity-60'}>
      <td className="px-3 py-1.5">{u.name}</td>
      <td className="px-3 py-1.5 text-fg-muted">{u.email ?? '—'}</td>
      <td className="px-3 py-1.5">{u.role}</td>
      <td className="px-3 py-1.5">{u.tenant_name ?? '—'}</td>
      <td className="px-3 py-1.5">{u.is_active ? '✓' : '✗'}</td>
      <td className="px-3 py-1.5 text-right">
        <form action={resetAction} className="inline-block">
          <input type="hidden" name="profileId" value={u.id} />
          <input type="hidden" name="userId" value={u.user_id} />
          <input type="hidden" name="email" value={u.email ?? ''} />
          <Button type="submit" variant="secondary" size="sm" disabled={resetPending || !u.email}>
            {resetPending ? '...' : 'Reset senha'}
          </Button>
        </form>
        {u.is_active ? (
          <form action={deactAction} className="ml-2 inline-block">
            <input type="hidden" name="profileId" value={u.id} />
            <input type="hidden" name="userId" value={u.user_id} />
            <input type="hidden" name="email" value={u.email ?? ''} />
            <Button type="submit" variant="secondary" size="sm" disabled={deactPending}>
              {deactPending ? '...' : 'Desativar'}
            </Button>
          </form>
        ) : null}
        {resetState.error || deactState.error ? (
          <span className="ml-2 text-[0.75rem] text-danger">
            {resetState.error || deactState.error}
          </span>
        ) : null}
        {resetState.ok || deactState.ok ? (
          <span className="ml-2 text-[0.75rem] text-success">✓</span>
        ) : null}
      </td>
    </tr>
  )
}
