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
    <section className="px-1 sm:px-2">
      <SectionEyebrow>Serviços</SectionEyebrow>
      <SectionHeadline>
        Cuidado <span className="font-light italic text-brand-accent">artesanal</span>
      </SectionHeadline>
      <ul className="mt-10 divide-y divide-border/60 border-y border-border/60">
        {services.map((s) => (
          <li
            key={s.id}
            className="grid grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-1 py-5 sm:py-6"
          >
            <h3 className="font-display text-[1.25rem] font-medium leading-tight text-fg sm:text-[1.5rem]">
              {s.name}
            </h3>
            <span className="font-display text-[1rem] font-medium tabular-nums text-brand-primary sm:text-[1.125rem]">
              {formatPrice(s.priceCents)}
            </span>
            <p className="col-start-1 max-w-md text-[0.875rem] leading-relaxed text-fg-muted">
              {s.description ?? `${s.durationMinutes} minutos de atendimento dedicado.`}
            </p>
            <p className="col-start-2 self-center text-[0.75rem] uppercase tracking-[0.18em] text-fg-subtle">
              {s.durationMinutes} min
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <Link
          href="/book"
          className="group inline-flex items-center gap-2 text-[0.875rem] font-medium uppercase tracking-[0.16em] text-brand-primary"
        >
          Ver todos e agendar
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </div>
    </section>
  )
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.6875rem] font-medium uppercase tracking-[0.32em] text-brand-accent">
      {children}
    </p>
  )
}

function SectionHeadline({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-3 font-display text-[2rem] font-medium leading-[1] tracking-tight text-fg sm:text-[2.75rem]">
      {children}
    </h2>
  )
}
