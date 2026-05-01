import { MapPin, MessageCircle, Clock } from 'lucide-react'
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
    <section className="px-1">
      <header className="mb-4">
        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-brand-accent">
          Onde nos encontrar
        </p>
        <h2 className="mt-1 font-display text-[1.5rem] font-semibold leading-tight tracking-tight text-fg">
          Contato e horário
        </h2>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {wa ? (
          <a
            href={`https://wa.me/${wa}`}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-border-strong"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-medium text-fg">WhatsApp</p>
              <p className="text-[0.8125rem] text-fg-muted">{props.whatsapp}</p>
            </div>
          </a>
        ) : null}

        {address ? (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-border-strong"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
              <MapPin className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-medium text-fg">Endereço</p>
              <p className="truncate text-[0.8125rem] text-fg-muted">{address}</p>
            </div>
          </a>
        ) : null}

        {hours.length > 0 ? (
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 sm:col-span-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
              <Clock className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="mb-2 font-medium text-fg">Horário de funcionamento</p>
              <ul className="space-y-1 text-[0.8125rem] text-fg-muted">
                {hours.map((h) => (
                  <li key={h.weekday} className="flex justify-between gap-3">
                    <span>{WEEKDAYS[h.weekday]}</span>
                    <span>
                      {h.isOpen
                        ? `${h.startTime.slice(0, 5)} – ${h.endTime.slice(0, 5)}`
                        : 'Fechado'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
