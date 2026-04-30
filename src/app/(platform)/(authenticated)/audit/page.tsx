import { listRecentAudit } from '@/lib/platform/audit-query'

export default async function AuditPage() {
  const entries = await listRecentAudit(200)
  const dateFmt = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <h1 className="font-display text-[1.5rem] font-semibold text-fg">Audit log</h1>
      <p className="text-[0.8125rem] text-fg-muted">Últimas {entries.length} entradas.</p>
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-[0.8125rem]">
          <thead className="bg-bg-subtle text-[0.75rem] uppercase tracking-wide text-fg-muted">
            <tr>
              <th className="px-3 py-2 text-left">Quando</th>
              <th className="px-3 py-2 text-left">Ator</th>
              <th className="px-3 py-2 text-left">Role</th>
              <th className="px-3 py-2 text-left">Action</th>
              <th className="px-3 py-2 text-left">Tenant</th>
              <th className="px-3 py-2 text-left">Entity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((e) => (
              <tr key={e.id} className="hover:bg-bg-subtle">
                <td className="px-3 py-1.5 text-fg-muted">
                  {dateFmt.format(new Date(e.created_at))}
                </td>
                <td className="px-3 py-1.5">{e.actor_email ?? e.actor_user_id ?? '—'}</td>
                <td className="px-3 py-1.5 text-fg-muted">{e.actor_role ?? '—'}</td>
                <td className="px-3 py-1.5 font-mono text-[0.75rem]">{e.action}</td>
                <td className="px-3 py-1.5 text-fg-muted">{e.tenant_name ?? '—'}</td>
                <td className="px-3 py-1.5 text-fg-muted">
                  {e.entity_type ?? ''}
                  {e.entity_id ? `#${e.entity_id.slice(0, 8)}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
