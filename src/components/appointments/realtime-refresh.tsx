'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'

type Props = {
  tenantId: string
  /**
   * Identificador opcional pra namespace do channel. Útil quando há mais de
   * uma subscription do tenant na mesma aba (ex: staff em outra rota).
   * Default: 'all'.
   */
  channelKey?: string
}

/**
 * Subscribe em postgres_changes da tabela `appointments` filtrando pelo
 * tenant. Em cada INSERT/UPDATE/DELETE dispara `router.refresh()` — o RSC
 * re-busca a agenda do servidor.
 *
 * Funciona pros dois lados (staff e cliente) porque o RLS aplicado no
 * broadcast já filtra o que cada user vê:
 *   - staff (BUSINESS_OWNER/RECEPTIONIST/PROFESSIONAL): recebe todos os
 *     appointments do tenant via `appointments_tenant_staff_all`
 *   - cliente (CUSTOMER): recebe só os próprios via
 *     `appointments_customer_read` (`customer_id IN (...)`)
 *
 * IMPORTANTE: aguarda a session carregar antes de subscribir e chama
 * `realtime.setAuth(jwt)` explicitamente. Sem isso, o WebSocket abre com
 * anon JWT antes dos cookies serem lidos, channel `SUBSCRIBED` com sucesso,
 * mas RLS rejeita os broadcasts (anon não satisfaz nem `is_tenant_staff()`
 * nem o `customer_id IN (...)`).
 *
 * Resiliência:
 *   - JWT refresh: onAuthStateChange propaga TOKEN_REFRESHED pro websocket.
 *   - Tab background / sleep / blip de rede: visibilitychange + auto-resubscribe
 *     em CHANNEL_ERROR/TIMED_OUT/CLOSED com backoff exponencial.
 *
 * Pré-requisito de DB: `appointments` precisa estar na publication
 * `supabase_realtime` E ter `replica identity full` (ver migration
 * `0023_appointments_realtime.sql`).
 */
export function RealtimeAppointmentsRefresh({ tenantId, channelKey = 'all' }: Props) {
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
      // Backoff exponencial: 1s, 2s, 4s, 8s, 16s, cap 30s. Reset em SUBSCRIBED.
      const delay = Math.min(1000 * 2 ** reconnectAttempts, 30000)
      reconnectAttempts += 1
      console.warn('[realtime] resubscrevendo em', delay, 'ms (tentativa', reconnectAttempts, ')')
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
        console.warn('[realtime] sem session, abortando subscribe')
        return
      }
      supabase.realtime.setAuth(token)

      // Limpa channel anterior antes de recriar (evita leak em reconnects).
      if (channel) {
        await supabase.removeChannel(channel)
        channel = null
      }
      if (cancelled) return

      console.warn('[realtime] subscribendo channel')
      channel = supabase
        .channel(`appointments:${tenantId}:${channelKey}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'appointments',
            filter: `tenant_id=eq.${tenantId}`,
          },
          (payload) => {
            console.warn('[realtime] appointments event', payload.eventType, payload)
            router.refresh()
          },
        )
        .subscribe((status, err) => {
          console.warn('[realtime] channel status', status, err ?? '')
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

    // JWT do Supabase expira em ~1h. onAuthStateChange dispara em
    // TOKEN_REFRESHED (auto a cada ~50min) e SIGNED_IN — propagamos pro WS.
    const { data: authSub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.access_token) return
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        supabase.realtime.setAuth(session.access_token)
        console.warn('[realtime] token atualizado', event)
      }
    })

    // Tab voltou pro foreground: browsers (Chrome/Safari) podem ter matado o
    // WebSocket em background. Refaz setAuth + force refresh dos dados (caso
    // tenhamos perdido events) e o auto-resubscribe cuida do channel se
    // estiver morto.
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return
      console.warn('[realtime] tab visível, revalidando')
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
  }, [tenantId, channelKey, router])

  return null
}
