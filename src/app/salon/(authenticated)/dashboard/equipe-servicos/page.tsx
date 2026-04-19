'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useTenantSlug } from '@/components/mock/tenant-slug-provider'
import { useMockStore } from '@/lib/mock/store'
import { ENTITY } from '@/lib/mock/entities'
import { Card, CardContent } from '@/components/ui/card'

export default function EquipeServicosPage() {
  const tenantSlug = useTenantSlug()
  const { data: professionals } = useMockStore(
    tenantSlug,
    ENTITY.professionals.key,
    ENTITY.professionals.schema,
    ENTITY.professionals.seed,
  )
  const { data: services } = useMockStore(
    tenantSlug,
    ENTITY.services.key,
    ENTITY.services.schema,
    ENTITY.services.seed,
  )
  const { data: links, setData: setLinks } = useMockStore(
    tenantSlug,
    ENTITY.professionalServices.key,
    ENTITY.professionalServices.schema,
    ENTITY.professionalServices.seed,
  )

  const set = useMemo(
    () => new Set(links.map((l) => `${l.professionalId}:${l.serviceId}`)),
    [links],
  )

  function toggle(professionalId: string, serviceId: string) {
    const exists = set.has(`${professionalId}:${serviceId}`)
    if (exists) {
      setLinks((prev) =>
        prev.filter((l) => !(l.professionalId === professionalId && l.serviceId === serviceId)),
      )
    } else {
      setLinks((prev) => [...prev, { professionalId, serviceId }])
    }
  }

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
          Agenda
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Equipe × Serviços
        </h1>
        <p className="mt-1 text-[0.875rem] text-fg-muted">
          Quem executa cada serviço do salão.
        </p>
      </header>

      <ul className="space-y-3">
        {professionals.map((p) => (
          <li key={p.id}>
            <Card className="shadow-xs">
              <CardContent className="py-4">
                <p className="mb-3 font-medium text-fg">{p.displayName || p.name}</p>
                <div className="flex flex-wrap gap-2">
                  {services
                    .filter((s) => s.isActive)
                    .map((s) => {
                      const on = set.has(`${p.id}:${s.id}`)
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggle(p.id, s.id)}
                          aria-pressed={on}
                          className={`rounded-full px-3 py-1.5 text-[0.8125rem] font-medium transition-colors ${
                            on
                              ? 'bg-brand-primary text-brand-primary-fg'
                              : 'bg-bg-subtle text-fg-muted hover:bg-surface-raised hover:text-fg'
                          }`}
                        >
                          {s.name}
                        </button>
                      )
                    })}
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </main>
  )
}
