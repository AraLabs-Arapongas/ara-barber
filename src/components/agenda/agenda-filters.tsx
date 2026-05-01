'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { SelectSheet } from '@/components/ui/select-sheet'

type Professional = { id: string; name: string }

export function AgendaFilters({ professionals }: { professionals: Professional[] }) {
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
      <SelectSheet
        value={profFilter}
        onChange={(v) => update('professional', v)}
        options={[
          { value: '', label: 'Todos os profissionais' },
          ...professionals.map((p) => ({ value: p.id, label: p.name })),
        ]}
        sheetTitle="Filtrar por profissional"
        className={selectClass}
      />
      <SelectSheet
        value={statusFilter}
        onChange={(v) => update('status', v)}
        options={[
          { value: '', label: 'Todos os status' },
          { value: 'SCHEDULED', label: 'Agendados' },
          { value: 'CONFIRMED', label: 'Confirmados' },
          { value: 'COMPLETED', label: 'Concluídos' },
          { value: 'CANCELED', label: 'Cancelados' },
          { value: 'NO_SHOW', label: 'Faltou' },
        ]}
        sheetTitle="Filtrar por status"
        className={selectClass}
      />
    </div>
  )
}
