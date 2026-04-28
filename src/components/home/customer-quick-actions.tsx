import { Fragment } from 'react'
import Link from 'next/link'
import { MapPin, MessageCircle, Phone } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

type Props = {
  contactPhone: string | null
  whatsapp: string | null
  /** Endereço pra montar URL do Google Maps. Quando vazio, esconde "Como chegar". */
  address: {
    line1: string | null
    line2: string | null
    city: string | null
    state: string | null
    postalCode: string | null
  }
}

/**
 * Linha de ações rápidas na home. Versão simplificada (2 colunas):
 *   - WhatsApp (ou Ligar como fallback) — prioriza wa.me se tenant tem
 *     whatsapp, senão tel: do contact_phone.
 *   - Como chegar — abre Google Maps com endereço do tenant.
 *
 * "Reagendar" não vive mais aqui — foi pra dentro do card da próxima
 * reserva (mais contextual).
 *
 * Itens só aparecem se há dado pra suportá-los. Quando nenhum,
 * fallback pra "Ver reservas" (sempre disponível pra logado).
 */
export function CustomerQuickActions({ contactPhone, whatsapp, address }: Props) {
  const items: Array<{
    href: string
    label: string
    icon: typeof MessageCircle
    external?: boolean
  }> = []

  // Comunicação: WhatsApp tem prioridade visual (UX melhor); telefone é fallback.
  if (whatsapp) {
    const digits = whatsapp.replace(/\D/g, '')
    items.push({
      href: `https://wa.me/${digits}`,
      label: 'WhatsApp',
      icon: MessageCircle,
      external: true,
    })
  } else if (contactPhone) {
    items.push({
      href: `tel:${contactPhone.replace(/\s/g, '')}`,
      label: 'Ligar',
      icon: Phone,
      external: true,
    })
  }

  // Como chegar: requer pelo menos line1 + city pra fazer sentido.
  if (address.line1 && address.city) {
    const fullAddress = [
      address.line1,
      address.line2,
      address.city && address.state ? `${address.city} - ${address.state}` : address.city,
      address.postalCode,
    ]
      .filter(Boolean)
      .join(', ')
    items.push({
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`,
      label: 'Como chegar',
      icon: MapPin,
      external: true,
    })
  }

  // Tenant sem WhatsApp + sem endereço: omite o bloco. "Reservas"
  // já existe na tab bar, então um card sozinho seria redundante.
  if (items.length === 0) return null

  // Layout: até 2 ações ficam lado-a-lado divididas por separador
  // vertical, igual ao mockup. 1 ação ocupa a linha inteira.
  if (items.length === 1) {
    const item = items[0]
    const Icon = item.icon
    const linkProps = item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {}
    return (
      <Card className="shadow-xs">
        <CardContent className="py-3">
          <Link
            href={item.href}
            {...linkProps}
            className="flex flex-col items-center gap-1.5 rounded-lg py-2 transition-colors hover:bg-bg-subtle focus-visible:bg-bg-subtle focus-visible:outline-none"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-[0.8125rem] font-medium text-fg">{item.label}</span>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-xs overflow-hidden">
      <CardContent className="grid grid-cols-[1fr_auto_1fr] items-stretch p-0">
        {items.slice(0, 2).map((item, idx) => {
          const Icon = item.icon
          const linkProps = item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {}
          return (
            <Fragment key={item.label}>
              <Link
                href={item.href}
                {...linkProps}
                className="flex flex-col items-center gap-1.5 py-4 transition-colors hover:bg-bg-subtle focus-visible:bg-bg-subtle focus-visible:outline-none"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="text-[0.8125rem] font-medium text-fg">{item.label}</span>
              </Link>
              {idx === 0 ? (
                <span aria-hidden="true" className="my-3 w-px bg-border" />
              ) : null}
            </Fragment>
          )
        })}
      </CardContent>
    </Card>
  )
}
