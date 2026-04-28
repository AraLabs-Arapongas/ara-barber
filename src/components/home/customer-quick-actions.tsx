import Link from 'next/link'
import { CalendarCheck, MessageCircle, Phone, RefreshCw } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

type Props = {
  /** Próximo agendamento (se houver) — usado pra montar URL de "reagendar". */
  nextAppointment: {
    id: string
    serviceId: string
    professionalId: string
  } | null
  contactPhone: string | null
  whatsapp: string | null
}

/**
 * Linha de ações rápidas na home do cliente. Cada ação é um Link puro
 * (sem state/server action) — mantém a home como Server Component.
 *
 * Mostra dinamicamente:
 *   - Reagendar (se há próxima reserva): vai pro /book pré-preenchido
 *     com mesmo serviço e profissional, step datetime. Cliente decide
 *     se cancela o original depois (UX manual, mais segura).
 *   - Falar (se tenant tem whatsapp ou contact_phone): wa.me ou tel:
 *   - Ver reservas: navega pra /meus-agendamentos.
 *
 * Sem appointment + sem contato: componente retorna null e a home
 * pula a seção.
 */
export function CustomerQuickActions({ nextAppointment, contactPhone, whatsapp }: Props) {
  const items: Array<{
    href: string
    label: string
    icon: typeof RefreshCw
    external?: boolean
  }> = []

  if (nextAppointment) {
    const params = new URLSearchParams({
      step: 'datetime',
      serviceId: nextAppointment.serviceId,
      professionalId: nextAppointment.professionalId,
    })
    items.push({
      href: `/book?${params.toString()}`,
      label: 'Reagendar',
      icon: RefreshCw,
    })
  }

  // Whatsapp tem prioridade (UX melhor que ligar). Telefone como fallback.
  if (whatsapp) {
    const digits = whatsapp.replace(/\D/g, '')
    items.push({
      href: `https://wa.me/${digits}`,
      label: 'Falar',
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

  items.push({
    href: '/meus-agendamentos',
    label: 'Reservas',
    icon: CalendarCheck,
  })

  if (items.length === 0) return null

  // Grid se ajusta automaticamente ao número de items (2 ou 3 colunas).
  const cols = items.length === 2 ? 'grid-cols-2' : 'grid-cols-3'

  return (
    <Card className="shadow-xs">
      <CardContent className={`grid ${cols} gap-1 py-3`}>
        {items.map((item) => {
          const Icon = item.icon
          const linkProps = item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {}
          return (
            <Link
              key={item.label}
              href={item.href}
              {...linkProps}
              className="flex flex-col items-center gap-1.5 rounded-lg py-2 transition-colors hover:bg-bg-subtle focus-visible:bg-bg-subtle focus-visible:outline-none"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="text-[0.75rem] font-medium text-fg">{item.label}</span>
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}
