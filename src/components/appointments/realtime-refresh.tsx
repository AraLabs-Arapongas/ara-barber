'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { invalidateAgendaForDay } from '@/lib/cache/invalidations'

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

    // Throttle pra router.refresh(): coalesce calls dentro de 1.5s numa só.
    // Sem isso, focus + visibilitychange + pageshow + N postgres_changes
    // disparam refreshes seguidos que martelam RSC fetch.
    const REFRESH_MIN_INTERVAL_MS = 1500
    let lastRefreshAt = 0
    let refreshTimer: ReturnType<typeof setTimeout> | null = null
    const requestRefresh = (origin: string) => {
      const now = Date.now()
      const elapsed = now - lastRefreshAt
      if (elapsed >= REFRESH_MIN_INTERVAL_MS) {
        lastRefreshAt = now
        console.warn('[realtime] refresh', origin)
        router.refresh()
        return
      }
      if (refreshTimer) return // já tem um agendado
      refreshTimer = setTimeout(() => {
        refreshTimer = null
        if (cancelled) return
        lastRefreshAt = Date.now()
        console.warn('[realtime] refresh (debounced)', origin)
        router.refresh()
      }, REFRESH_MIN_INTERVAL_MS - elapsed)
    }

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
            // Extrai dateISO do evento pra invalidar cache do dia certo.
            // payload.new pra INSERT/UPDATE; payload.old pra DELETE.
            const startAt =
              (payload.new as { start_at?: string } | undefined)?.start_at ??
              (payload.old as { start_at?: string } | undefined)?.start_at
            if (startAt) {
              const dateISO = startAt.slice(0, 10)
              // Fire-and-forget: server action invalida tag, depois disparamos refresh.
              void invalidateAgendaForDay(tenantId, dateISO).catch((e) =>
                console.warn('[realtime] invalidate failed', e),
              )
            }
            requestRefresh(`postgres:${payload.eventType}`)
          },
        )
        .subscribe((status, err) => {
          console.warn('[realtime] channel status', status, err ?? '')
          if (status === 'SUBSCRIBED') {
            reconnectAttempts = 0
            clearReconnectTimer()
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
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

    // Reage a 3 eventos diferentes de "tela voltou ativa" pra cobrir todos
    // os cenários:
    //   - visibilitychange: tab passa de hidden→visible (mudou de aba, voltou).
    //   - focus: janela ganhou foco de teclado (split-screen, duas janelas
    //     lado-a-lado — nenhuma fica "hidden", visibilitychange não fira).
    //   - pageshow: página voltou do bfcache (back/forward do browser).
    // Todos disparam o mesmo handler: re-setAuth + router.refresh() pra
    // garantir dados frescos mesmo se um event de realtime foi perdido.
    const handleResume = (origin: string) => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      void (async () => {
        const { data } = await supabase.auth.getSession()
        if (data.session?.access_token) {
          supabase.realtime.setAuth(data.session.access_token)
        }
        requestRefresh(`resume:${origin}`)
      })()
    }
    const onVisibility = () => handleResume('visibilitychange')
    const onFocus = () => handleResume('focus')
    const onPageShow = () => handleResume('pageshow')
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    window.addEventListener('pageshow', onPageShow)

    return () => {
      cancelled = true
      clearReconnectTimer()
      if (refreshTimer) clearTimeout(refreshTimer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('pageshow', onPageShow)
      authSub.subscription.unsubscribe()
      if (channel) void supabase.removeChannel(channel)
    }
  }, [tenantId, channelKey, router])

  return null
}
