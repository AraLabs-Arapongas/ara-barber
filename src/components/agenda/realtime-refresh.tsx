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
 */
export function RealtimeAgendaRefresh({ tenantId }: Props) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`agenda:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          router.refresh()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [tenantId, router])

  return null
}
