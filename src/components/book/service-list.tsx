'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ChevronRight, Search, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { bookHrefWith, type BookParams } from '@/lib/booking/params'
import type { BookingService } from '@/lib/booking/queries'
import { formatCentsToBrl } from '@/lib/money'

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

type Props = {
  services: BookingService[]
  current: BookParams
}

export function BookServiceList({ services, current }: Props) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return services
    return services.filter((s) => {
      const haystack = normalize(`${s.name} ${s.description ?? ''}`)
      return haystack.includes(q)
    })
  }, [services, query])

  return (
    <>
      {services.length > 3 ? (
        <div className="relative mb-3">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar serviço..."
            className="w-full rounded-lg border border-transparent bg-bg-subtle py-2.5 pl-10 pr-10 text-[0.9375rem] text-fg placeholder:text-fg-subtle focus:border-brand-primary focus:bg-surface-raised focus:outline-none"
            aria-label="Buscar serviço"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-fg-subtle hover:bg-border hover:text-fg"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ) : null}

      {filtered.length > 0 ? (
        <ul className="space-y-2">
          {filtered.map((s) => {
            const selected = current.serviceId === s.id
            return (
              <li key={s.id}>
                <Link
                  href={bookHrefWith('/book/profissional', { ...current, serviceId: s.id })}
                  className="block"
                >
                  <Card
                    className={`transition-colors ${
                      selected
                        ? 'border-brand-primary bg-surface-raised shadow-md'
                        : 'shadow-xs hover:border-border-strong'
                    }`}
                  >
                    <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-fg">{s.name}</p>
                        <p className="truncate text-[0.8125rem] text-fg-muted">
                          {s.durationMinutes} min · {formatCentsToBrl(s.priceCents)}
                        </p>
                        {s.description ? (
                          <p className="mt-1 line-clamp-2 text-[0.75rem] text-fg-subtle">
                            {s.description}
                          </p>
                        ) : null}
                      </div>
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-fg-subtle"
                        aria-hidden="true"
                      />
                    </div>
                  </Card>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-6 text-center text-[0.875rem] text-fg-muted">
          Nada encontrado para <strong>{query}</strong>.
        </div>
      )}
    </>
  )
}
