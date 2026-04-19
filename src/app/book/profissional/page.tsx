'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Sparkles, User } from 'lucide-react'
import { useTenantSlug } from '@/components/mock/tenant-slug-provider'
import { useMockStore } from '@/lib/mock/store'
import { ENTITY } from '@/lib/mock/entities'
import { Card } from '@/components/ui/card'
import { StepIndicator } from '@/components/book/step-indicator'
import { bookHrefWith, parseBookParams } from '@/lib/mock/booking-params'

export default function BookStepProfessional() {
  const tenantSlug = useTenantSlug()
  const { data: professionals } = useMockStore(
    tenantSlug,
    ENTITY.professionals.key,
    ENTITY.professionals.schema,
    ENTITY.professionals.seed,
  )
  const { data: links } = useMockStore(
    tenantSlug,
    ENTITY.professionalServices.key,
    ENTITY.professionalServices.schema,
    ENTITY.professionalServices.seed,
  )
  const sp = useSearchParams()
  const current = parseBookParams(sp ?? new URLSearchParams())

  if (!current.serviceId) {
    return (
      <main className="mx-auto w-full max-w-xl px-5 py-10 sm:px-6">
        <p className="text-fg-muted">
          Escolha um serviço primeiro.{' '}
          <Link href="/book" className="font-medium text-brand-primary hover:underline">
            Voltar
          </Link>
        </p>
      </main>
    )
  }

  const serviceLinks = new Set(
    links.filter((l) => l.serviceId === current.serviceId).map((l) => l.professionalId),
  )
  const eligible = professionals.filter((p) => p.isActive && serviceLinks.has(p.id))

  return (
    <main className="mx-auto w-full max-w-xl px-5 pt-6 pb-24 sm:px-6">
      <Link
        href={bookHrefWith('/book', current)}
        className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] text-fg-muted hover:text-fg"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Serviço
      </Link>

      <StepIndicator current={2} total={6} labels={['Serviço', 'Profissional', 'Data', 'Horário', 'Login', 'Confirmar']} />

      <h1 className="font-display text-[1.625rem] font-semibold leading-tight tracking-tight text-fg">
        Com quem?
      </h1>
      <p className="mt-1 mb-5 text-[0.9375rem] text-fg-muted">
        Escolha o profissional ou deixa por nossa conta.
      </p>

      <ul className="space-y-2">
        <li>
          <Link
            href={bookHrefWith('/book/data', { ...current, professionalId: 'any' })}
            className="block"
          >
            <Card className="shadow-xs transition-colors hover:border-border-strong">
              <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-fg">Qualquer profissional</p>
                  <p className="truncate text-[0.8125rem] text-fg-muted">
                    Mostramos todos os horários disponíveis.
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />
              </div>
            </Card>
          </Link>
        </li>
        {eligible.map((p) => (
          <li key={p.id}>
            <Link
              href={bookHrefWith('/book/data', { ...current, professionalId: p.id })}
              className="block"
            >
              <Card className="shadow-xs transition-colors hover:border-border-strong">
                <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-subtle text-fg-muted">
                    <User className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-fg">{p.displayName || p.name}</p>
                    {p.phone ? (
                      <p className="truncate text-[0.8125rem] text-fg-muted">{p.phone}</p>
                    ) : null}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />
                </div>
              </Card>
            </Link>
          </li>
        ))}
        {eligible.length === 0 ? (
          <li className="rounded-xl border border-border bg-surface p-6 text-center text-[0.875rem] text-fg-muted">
            Nenhum profissional atende este serviço ainda.
          </li>
        ) : null}
      </ul>
    </main>
  )
}
