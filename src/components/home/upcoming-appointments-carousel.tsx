'use client'

import { useEffect, useRef, useState } from 'react'

import { NextAppointmentCardHero } from './next-appointment-card'
import type { AppointmentStatus } from '@/lib/appointments/status-rules'

type Appointment = {
  id: string
  serviceId: string
  serviceName: string | null
  professionalId: string
  professionalName: string | null
  startAt: string
  status: AppointmentStatus
}

type Props = {
  appointments: Appointment[]
  tenantTimezone: string
  cancellationWindowMinutes: number
  customerCanCancel: boolean
}

/**
 * Carousel horizontal de próximas reservas do cliente. Cada card é o
 * mesmo `NextAppointmentCardHero` usado em outros lugares — aqui só
 * empilhamos N deles em scroll horizontal com snap.
 *
 * UX:
 *   - 1 reserva → sem carousel chrome (renderiza só o card).
 *   - 2+ reservas → scroll horizontal com snap-mandatory + dots
 *     embaixo indicando posição. Mobile-first: swipe natural.
 *
 * Implementação CSS-only pra scroll (sem libs). A posição atual vem
 * do scrollLeft do container, calculada em scroll handler com
 * requestAnimationFrame pra throttle.
 */
export function UpcomingAppointmentsCarousel({
  appointments,
  tenantTimezone,
  cancellationWindowMinutes,
  customerCanCancel,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el || appointments.length <= 1) return

    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        // Cada card ocupa 100% da largura do container; o índice ativo
        // é round(scrollLeft / cardWidth).
        const cardWidth = el.clientWidth
        if (cardWidth === 0) return
        const idx = Math.round(el.scrollLeft / cardWidth)
        setActiveIdx(idx)
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [appointments.length])

  if (appointments.length === 0) return null

  // 1 reserva: sem carousel chrome.
  if (appointments.length === 1) {
    const a = appointments[0]
    return (
      <NextAppointmentCardHero
        appointment={a}
        tenantTimezone={tenantTimezone}
        cancellationWindowMinutes={cancellationWindowMinutes}
        customerCanCancel={customerCanCancel}
      />
    )
  }

  return (
    <div className="space-y-2">
      {/* Carousel com "peek" do card anterior à esquerda quando scrollado.
          Truque: cada card é mais estreito que o viewport (calc(100%-4rem))
          + scroll-padding-left de 2rem. snap-start alinha o card focado
          NÃO no edge do viewport, mas 32px à frente — o que mostra a
          tail do anterior. Card 1 não tem anterior, então o "peek" vira
          padding visual (32px de espaço vazio à esquerda — aceito;
          dá respiro e faz o card parecer parte da grade). */}
      <div
        ref={containerRef}
        className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth scroll-pl-8 px-5 sm:-mx-6 sm:scroll-pl-9 sm:px-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {appointments.map((a) => (
          <div key={a.id} className="w-[calc(100%-4rem)] shrink-0 snap-start">
            <NextAppointmentCardHero
              appointment={a}
              tenantTimezone={tenantTimezone}
              cancellationWindowMinutes={cancellationWindowMinutes}
              customerCanCancel={customerCanCancel}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-1.5">
        {appointments.map((a, i) => (
          <button
            key={a.id}
            type="button"
            aria-label={`Ir pra reserva ${i + 1}`}
            onClick={() => {
              const el = containerRef.current
              if (el) el.scrollTo({ left: el.clientWidth * i, behavior: 'smooth' })
            }}
            className={`h-1.5 rounded-full transition-all ${
              i === activeIdx ? 'w-6 bg-brand-primary' : 'w-1.5 bg-border'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
