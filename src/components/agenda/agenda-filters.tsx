'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type Professional = { id: string; name: string }

export function AgendaFilters({
  professionals,
}: {
  professionals: Professional[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const profFilter = sp?.get('professional') ?? ''
  const statusFilter = sp?.get('status') ?? ''

  function update(key: string, value: string) {
    const params = new URLSearchParams(sp?.toString() ?? '')
    if (value) params.set(key, value)
    else params.delete(key)
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  const selectClass =
    'rounded-lg border border-border bg-surface px-3 py-1.5 text-[0.8125rem] text-fg shadow-xs focus:border-brand-primary focus:outline-none'

  return (
    <div className="my-3 flex gap-2 overflow-x-auto">
      <select
        value={profFilter}
        onChange={(e) => update('professional', e.target.value)}
        className={selectClass}
        aria-label="Filtrar por profissional"
      >
        <option value="">Todos os profissionais</option>
        {professionals.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select
        value={statusFilter}
        onChange={(e) => update('status', e.target.value)}
        className={selectClass}
        aria-label="Filtrar por status"
      >
        <option value="">Todos os status</option>
        <option value="SCHEDULED">Agendados</option>
        <option value="CONFIRMED">Confirmados</option>
        <option value="COMPLETED">Concluídos</option>
        <option value="CANCELED">Cancelados</option>
        <option value="NO_SHOW">Faltou</option>
      </select>
    </div>
  )
}
