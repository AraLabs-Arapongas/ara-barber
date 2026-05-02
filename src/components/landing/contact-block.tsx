import { MapPin } from 'lucide-react'
import type { BusinessHour } from '@/lib/booking/queries'

/** Logo oficial do WhatsApp (#25D366) — bolha + telefone. */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="#25D366"
      aria-hidden="true"
    >
      <path d="M16 .5C7.44.5.5 7.44.5 16c0 2.82.74 5.58 2.15 8L.5 31.5l7.69-2.02A15.4 15.4 0 0 0 16 31.5C24.56 31.5 31.5 24.56 31.5 16S24.56.5 16 .5zm0 28.27c-2.45 0-4.85-.66-6.94-1.9l-.5-.3-4.57 1.2 1.22-4.45-.32-.51A12.78 12.78 0 1 1 28.77 16c0 7.04-5.73 12.77-12.77 12.77zm7-9.55c-.38-.19-2.27-1.12-2.62-1.25-.35-.13-.6-.19-.86.19-.25.38-.99 1.25-1.21 1.5-.22.25-.45.29-.83.1-.38-.19-1.62-.6-3.08-1.9a11.6 11.6 0 0 1-2.13-2.65c-.22-.38-.02-.58.17-.77.17-.17.38-.45.57-.67.19-.22.25-.38.38-.64.13-.25.06-.48-.03-.67-.1-.19-.86-2.07-1.18-2.83-.31-.74-.62-.64-.86-.65l-.73-.01a1.4 1.4 0 0 0-1.02.48c-.35.38-1.34 1.31-1.34 3.2s1.37 3.71 1.56 3.97c.19.25 2.7 4.13 6.55 5.79 2.29.99 3.18 1.07 4.32.9.69-.1 2.27-.93 2.59-1.83.32-.9.32-1.66.22-1.83-.1-.16-.35-.26-.73-.45z" />
    </svg>
  )
}


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

/**
 * Formata número BR pra exibição: aceita 10/11 dígitos (com ou sem DDI).
 * - 5543999990001 → +55 (43) 99999-0001
 * - 43999990001   → (43) 99999-0001
 * - 4333334444    → (43) 3333-4444
 */
function formatPhoneBR(raw: string | null): string | null {
  if (!raw) return null
  let d = digits(raw)
  let prefix = ''
  if (d.length === 13 && d.startsWith('55')) {
    prefix = '+55 '
    d = d.slice(2)
  } else if (d.length === 12 && d.startsWith('55')) {
    prefix = '+55 '
    d = d.slice(2)
  }
  if (d.length === 11) {
    return `${prefix}(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  }
  if (d.length === 10) {
    return `${prefix}(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  }
  return raw // fallback: deixa como veio
}

/** Versão exibida ao usuário: rua + complemento + cidade. Sem UF/CEP (ruído). */
function displayAddress(props: Props): string | null {
  const parts = [props.addressLine1, props.addressLine2, props.city].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
}

/** Versão completa pra geocoding do mapa (mantém UF/CEP pra precisão). */
function geocodeAddress(props: Props): string | null {
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
  const address = displayAddress(props)
  const mapQuery = geocodeAddress(props) ?? address
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
        <div className="flex flex-col gap-3">
          {wa ? (
            <a
              href={`https://wa.me/${wa}`}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={`WhatsApp ${formatPhoneBR(props.whatsapp)}`}
              className="group flex items-center gap-4"
            >
              <WhatsAppIcon className="h-6 w-6 shrink-0" />
              <p className="font-display text-[1rem] leading-relaxed text-fg group-hover:text-brand-primary">
                {formatPhoneBR(props.whatsapp)}
              </p>
            </a>
          ) : null}

          {address ? (
            <>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery)}`}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={`Como chegar: ${address}`}
                className="group flex items-start gap-4"
              >
                <MapPin
                  className="mt-1 h-5 w-5 shrink-0 fill-[#EA4335] text-[#EA4335]"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                <p className="min-w-0 font-display text-[1rem] leading-relaxed text-fg group-hover:text-brand-primary">
                  {address}
                </p>
              </a>

              {/* Mapa embed (legacy maps.google.com — não precisa de API key).
                  Em mobile usa aspect 4:3; em sm+ vira flex-1 pra encher o
                  espaço vertical que a coluna de Horário ocupa ao lado. */}
              <div className="mt-1 flex-1 overflow-hidden rounded-2xl border border-border/60">
                <iframe
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title={`Mapa de ${address}`}
                  className="block aspect-[4/3] h-full min-h-[260px] w-full sm:aspect-auto"
                  style={{ border: 0 }}
                />
              </div>
            </>
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
