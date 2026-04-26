'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'

type Props = {
  tenantId: string
}

/**
 * Subscribe em postgres_changes da tabela appointments filtrando pelo tenant.
 * Em cada INSERT/UPDATE/DELETE dispara router.refresh() — o RSC re-busca a
 * agenda do servidor.
 *
 * IMPORTANTE: aguarda a session carregar antes de subscribir e chama
 * realtime.setAuth(jwt) explicitamente. Sem isso, o WebSocket abre com anon
 * JWT antes dos cookies serem lidos, channel SUBSCRIBED com sucesso, mas RLS
 * rejeita os broadcasts (anon não satisfaz is_tenant_staff()).
 */
export function RealtimeAgendaRefresh({ tenantId }: Props) {
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
        .channel(`agenda:${tenantId}`)
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
  }, [tenantId, router])

  return null
}
