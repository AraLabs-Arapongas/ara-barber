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

    void (async () => {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (cancelled) return
      if (!token) {
        console.warn('[realtime] sem session, abortando subscribe')
        return
      }
      supabase.realtime.setAuth(token)
      console.warn('[realtime] setAuth ok, subscribendo channel')

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
        })
    })()

    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [tenantId, channelKey, router])

  return null
}
