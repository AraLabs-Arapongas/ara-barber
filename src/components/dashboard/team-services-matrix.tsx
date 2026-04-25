'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { toggleProfessionalService } from '@/app/admin/(authenticated)/actions/professional-services'

type Pro = { id: string; name: string; displayName: string | null }
type Svc = { id: string; name: string; isActive: boolean }
type Link = { professionalId: string; serviceId: string }

type Props = {
  professionals: Pro[]
  services: Svc[]
  links: Link[]
}

export function TeamServicesMatrix({ professionals, services, links }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [optimistic, setOptimistic] = useState<Set<string>>(
    () => new Set(links.map((l) => `${l.professionalId}:${l.serviceId}`)),
  )
  const activeServices = useMemo(() => services.filter((s) => s.isActive), [services])

  function toggle(professionalId: string, serviceId: string) {
    const key = `${professionalId}:${serviceId}`
    const currentlyLinked = optimistic.has(key)
    const next = new Set(optimistic)
    if (currentlyLinked) next.delete(key)
    else next.add(key)
    setOptimistic(next)
    setError(null)

    startTransition(async () => {
      const result = await toggleProfessionalService({
        professionalId,
        serviceId,
        link: !currentlyLinked,
      })
      if (!result.ok) {
        setError(result.error)
        const rollback = new Set(next)
        if (currentlyLinked) rollback.add(key)
        else rollback.delete(key)
        setOptimistic(rollback)
        return
      }
      router.refresh()
    })
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Agenda
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Equipe × Serviços
        </h1>
        <p className="mt-1 text-[0.875rem] text-fg-muted">
          Quem executa cada serviço.
        </p>
      </header>

      {error ? (
        <Alert variant="error" className="mb-3">
          {error}
        </Alert>
      ) : null}

      <ul className="space-y-3">
        {professionals.map((p) => (
          <li key={p.id}>
            <Card className="shadow-xs">
              <CardContent className="py-4">
                <p className="mb-3 font-medium text-fg">{p.displayName || p.name}</p>
                <div className="flex flex-wrap gap-2">
                  {activeServices.map((s) => {
                    const key = `${p.id}:${s.id}`
                    const on = optimistic.has(key)
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggle(p.id, s.id)}
                        aria-pressed={on}
                        disabled={pending}
                        className={`rounded-full px-3 py-1.5 text-[0.8125rem] font-medium transition-colors disabled:opacity-60 ${
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
