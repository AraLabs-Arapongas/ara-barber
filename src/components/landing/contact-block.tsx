import { MapPin, MessageCircle } from 'lucide-react'
import type { BusinessHour } from '@/lib/booking/queries'

type Props = {
  whatsapp: string | null
  contactPhone: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  businessHours: BusinessHour[]
}

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function digits(s: string): string {
  return s.replace(/\D/g, '')
}

function fullAddress(props: Props): string | null {
  const parts = [
    props.addressLine1,
    props.addressLine2,
    [props.city, props.state].filter(Boolean).join(' - '),
    props.postalCode,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
}

export function ContactBlock(props: Props) {
  const wa = props.whatsapp ? digits(props.whatsapp) : null
  const address = fullAddress(props)
  const hasAny = wa || props.contactPhone || address || props.businessHours.length > 0
  if (!hasAny) return null

  const hours = [...props.businessHours].sort((a, b) => a.weekday - b.weekday)

  return (
    <section className="px-1 sm:px-2">
      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.32em] text-brand-accent">
        Onde nos encontrar
      </p>
      <h2 className="mt-3 font-display text-[2rem] font-medium leading-[1] tracking-tight text-fg sm:text-[2.75rem]">
        Estamos <span className="font-light italic text-brand-accent">pertinho</span>
      </h2>

      <div className="mt-10 grid gap-10 sm:grid-cols-2">
        <div className="space-y-6">
          {wa ? (
            <a
              href={`https://wa.me/${wa}`}
              target="_blank"
              rel="noreferrer noopener"
              className="group flex items-start gap-4"
            >
              <MessageCircle className="mt-1 h-5 w-5 text-brand-accent" strokeWidth={1.5} aria-hidden="true" />
              <div>
                <p className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-fg-subtle">
                  WhatsApp
                </p>
                <p className="mt-1 font-display text-[1.125rem] text-fg group-hover:text-brand-primary">
                  {props.whatsapp}
                </p>
              </div>
            </a>
          ) : null}

          {address ? (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
              target="_blank"
              rel="noreferrer noopener"
              className="group flex items-start gap-4"
            >
              <MapPin className="mt-1 h-5 w-5 text-brand-accent" strokeWidth={1.5} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-fg-subtle">
                  Endereço
                </p>
                <p className="mt-1 font-display text-[1rem] leading-relaxed text-fg group-hover:text-brand-primary">
                  {address}
                </p>
              </div>
            </a>
          ) : null}
        </div>

        {hours.length > 0 ? (
          <div>
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-fg-subtle">
              Horário
            </p>
            <dl className="mt-3 divide-y divide-border/60 border-y border-border/60">
              {hours.map((h) => (
                <div key={h.weekday} className="flex justify-between gap-3 py-2.5 text-[0.875rem]">
                  <dt className="text-fg">{WEEKDAYS[h.weekday]}</dt>
                  <dd className="tabular-nums text-fg-muted">
                    {h.isOpen ? `${h.startTime.slice(0, 5)} – ${h.endTime.slice(0, 5)}` : 'Fechado'}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>
    </section>
  )
}
