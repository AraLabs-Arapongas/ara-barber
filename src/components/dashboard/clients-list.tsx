'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { InitialsAvatar } from '@/components/ui/initials-avatar'
import { formatCentsToBrl } from '@/lib/money'
import { MoneyValue } from '@/components/ui/money-value'

export type ClientItem = {
  id: string
  name: string
  email: string | null
  phone: string | null
  createdAt: string
  appointmentsCount: number
  lastAt: string | null
  totalCents: number
}

type Props = {
  items: ClientItem[]
  tenantTimezone: string
}

function fmtDate(iso: string | null, tz: string): string | null {
  if (!iso) return null
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: tz,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

export function ClientsList({ items, tenantTimezone }: Props) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.phone ?? '').toLowerCase().includes(q) ||
        (i.email ?? '').toLowerCase().includes(q),
    )
  }, [search, items])

  return (
    <div>
      <Input
        type="search"
        placeholder="Buscar por nome, telefone ou e-mail"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        leftIcon={<Search className="h-4 w-4" />}
        containerClassName="mb-3"
      />
      {filtered.length === 0 ? (
        <Card className="shadow-xs">
          <CardContent className="py-10 text-center">
            <p className="text-[0.9375rem] text-fg-muted">
              {search
                ? 'Nenhum cliente encontrado.'
                : 'Nenhum cliente ainda. Assim que alguém agendar, aparece aqui.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {filtered.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/dashboard/clientes/${c.id}`} className="block transition-colors">
                <Card className="shadow-xs hover:bg-bg-subtle/50">
                  <div className="flex items-start gap-3 px-4 py-3 sm:px-5">
                    <InitialsAvatar name={c.name} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-fg">{c.name}</p>
                      <p className="truncate text-[0.8125rem] text-fg-muted">
                        {c.phone ?? c.email ?? '(sem contato)'}
                      </p>
                      <p className="mt-1 text-[0.75rem] text-fg-subtle">
                        {c.appointmentsCount} agendamento
                        {c.appointmentsCount === 1 ? '' : 's'}
                        {c.lastAt ? ` · último em ${fmtDate(c.lastAt, tenantTimezone)}` : ''}
                        {c.totalCents > 0 ? (
                          <>
                            {' · '}
                            <MoneyValue value={formatCentsToBrl(c.totalCents)} /> concluído
                          </>
                        ) : null}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
