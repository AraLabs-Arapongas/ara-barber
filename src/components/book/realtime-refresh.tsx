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
 * Funciona só pra usuário authenticated (RLS no broadcast). Visitante
 * anon (pré-login no wizard `/book`) não recebe events — aceito porque
 * slots são re-fetched quando o cliente faz login inline no step
 * "Confirmar".
 *
 * Resiliência: TOKEN_REFRESHED → setAuth, visibilitychange → re-setAuth +
 * router.refresh, auto-resubscribe com backoff em CHANNEL_ERROR/TIMED_OUT/CLOSED.
 *
 * Pré-requisito DB: ver migration `0024_booking_flow_realtime.sql`.
 */
export function RealtimeBookingRefresh({ tenantId }: Props) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false
    let reconnectAttempts = 0
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const clearReconnectTimer = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    }

    const scheduleReconnect = () => {
      if (cancelled) return
      clearReconnectTimer()
      const delay = Math.min(1000 * 2 ** reconnectAttempts, 30000)
      reconnectAttempts += 1
      console.warn(
        '[realtime/book] resubscrevendo em',
        delay,
        'ms (tentativa',
        reconnectAttempts,
        ')',
      )
      reconnectTimer = setTimeout(() => {
        void connect()
      }, delay)
    }

    const connect = async () => {
      if (cancelled) return
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (cancelled) return
      if (!token) {
        // Visitante anon (pré-login no wizard) — silenciosamente não subscribe.
        return
      }
      supabase.realtime.setAuth(token)

      if (channel) {
        await supabase.removeChannel(channel)
        channel = null
      }
      if (cancelled) return

      console.warn('[realtime/book] subscribendo channel')
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
          if (status === 'SUBSCRIBED') {
            reconnectAttempts = 0
            clearReconnectTimer()
          } else if (
            status === 'CHANNEL_ERROR' ||
            status === 'TIMED_OUT' ||
            status === 'CLOSED'
          ) {
            scheduleReconnect()
          }
        })
    }

    void connect()

    const { data: authSub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.access_token) return
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        supabase.realtime.setAuth(session.access_token)
        console.warn('[realtime/book] token atualizado', event)
      }
    })

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return
      console.warn('[realtime/book] tab visível, revalidando')
      void (async () => {
        const { data } = await supabase.auth.getSession()
        if (data.session?.access_token) {
          supabase.realtime.setAuth(data.session.access_token)
        }
        router.refresh()
      })()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      clearReconnectTimer()
      document.removeEventListener('visibilitychange', handleVisibility)
      authSub.subscription.unsubscribe()
      if (channel) void supabase.removeChannel(channel)
    }
  }, [tenantId, router])

  return null
}
