'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'

type Props = {
  tenantId: string
}

/**
 * Realtime do flow de booking: subscribe nas tabelas operacionais que
 * influenciam slots e regras visíveis pro cliente. Em qualquer mudança,
 * `router.refresh()` re-busca os dados server-rendered (slots, calendário,
 * etc).
 *
 * Tabelas:
 *   - availability_blocks: staff bloqueia/desbloqueia horário
 *   - business_hours: staff fecha/abre dia
 *   - professional_availability: staff muda jornada do profissional
 *
 * NÃO subscribe `appointments` — RLS impede cliente de ver outras reservas
 * (privacidade). Conflito de slot (outro cliente bookou primeiro) é tratado
 * no submit via RPC `validate_appointment_conflict`.
 *
 * NÃO subscribe `tenants` — contém info sensível de billing. Mudanças de
 * regras durante uma sessão de booking são raras o suficiente pra aceitar
 * a defasagem.
 *
 * Funciona só pra usuário authenticated (RLS no broadcast). Pré-login
 * (visitante anon em /book/horario) o subscriber não recebe events. Aceito
 * — visitante anon refresca slots quando avança pra /book/login → server
 * fetch fresh.
 *
 * Pré-requisito DB: ver migration `0024_booking_flow_realtime.sql`.
 */
export function RealtimeBookingRefresh({ tenantId }: Props) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    void (async () => {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (cancelled) return
      if (!token) {
        // Visitante anon (pré /book/login) — silenciosamente não subscribe.
        // Refresh acontece via server fetch quando avança pro próximo step.
        return
      }
      supabase.realtime.setAuth(token)
      console.warn('[realtime/book] setAuth ok, subscribendo channel')

      channel = supabase
        .channel(`book:${tenantId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'availability_blocks',
            filter: `tenant_id=eq.${tenantId}`,
          },
          (payload) => {
            console.warn('[realtime/book] availability_blocks', payload.eventType)
            router.refresh()
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'business_hours',
            filter: `tenant_id=eq.${tenantId}`,
          },
          (payload) => {
            console.warn('[realtime/book] business_hours', payload.eventType)
            router.refresh()
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'professional_availability',
            filter: `tenant_id=eq.${tenantId}`,
          },
          (payload) => {
            console.warn('[realtime/book] professional_availability', payload.eventType)
            router.refresh()
          },
        )
        .subscribe((status, err) => {
          console.warn('[realtime/book] channel status', status, err ?? '')
        })
    })()

    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [tenantId, router])

  return null
}
