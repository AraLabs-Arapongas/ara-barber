import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { BookingService } from '@/lib/booking/queries'

type Props = {
  services: BookingService[]
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100)
}

export function ServicesBlock({ services }: Props) {
  if (services.length === 0) return null
  return (
    <section className="px-1">
      <header className="mb-4">
        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-brand-accent">
          Nossos serviços
        </p>
        <h2 className="mt-1 font-display text-[1.5rem] font-semibold leading-tight tracking-tight text-fg">
          O que oferecemos
        </h2>
      </header>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {services.map((s) => (
          <li
            key={s.id}
            className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 shadow-xs"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-display text-[1rem] font-semibold leading-tight text-fg">
                {s.name}
              </h3>
              <span className="shrink-0 text-[0.875rem] font-semibold text-brand-primary">
                {formatPrice(s.priceCents)}
              </span>
            </div>
            {s.description ? (
              <p className="text-[0.8125rem] leading-relaxed text-fg-muted">{s.description}</p>
            ) : null}
            <p className="text-[0.75rem] text-fg-subtle">{s.durationMinutes} min</p>
          </li>
        ))}
      </ul>
      <div className="mt-5">
        <Link
          href="/book"
          className="inline-flex items-center gap-1 text-[0.875rem] font-medium text-brand-primary hover:underline"
        >
          Ver todos e agendar
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}
