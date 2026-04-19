'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { useTenantSlug } from '@/components/mock/tenant-slug-provider'
import { useMockStore, mockId } from '@/lib/mock/store'
import { ENTITY } from '@/lib/mock/entities'
import type { Customer } from '@/lib/mock/schemas'

const STAFF_ROLES = new Set([
  'PLATFORM_ADMIN',
  'SALON_OWNER',
  'RECEPTIONIST',
  'PROFESSIONAL',
])

/**
 * Espelha sessão real do Supabase no mock `currentCustomer` + upserta
 * entrada em `customers`. Filtra usuários staff (têm linha em user_profiles
 * com role != CUSTOMER) — eles não devem aparecer como cliente na home.
 */
export function CustomerSessionSync() {
  const tenantSlug = useTenantSlug()
  const { data: customers, setData: setCustomers } = useMockStore(
    tenantSlug,
    ENTITY.customers.key,
    ENTITY.customers.schema,
    ENTITY.customers.seed,
  )
  const { setData: setSession } = useMockStore(
    tenantSlug,
    ENTITY.currentCustomer.key,
    ENTITY.currentCustomer.schema,
    ENTITY.currentCustomer.seed,
  )

  const customersRef = useRef(customers)
  useEffect(() => {
    customersRef.current = customers
  }, [customers])

  useEffect(() => {
    const supabase = createClient()

    async function handle(userId: string | null, email: string | null, meta: Record<string, unknown> | null) {
      if (!userId || !email) {
        setSession({ customerId: null, email: null })
        return
      }

      // Descobre se é staff olhando user_profiles. Query passa pela RLS
      // self_read — anon/authenticated consegue ler só o próprio registro.
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle()

      if (profile && STAFF_ROLES.has(profile.role)) {
        // É staff, não cliente. Limpa o mock pra não misturar as sessões.
        setSession({ customerId: null, email: null })
        return
      }

      const fullName =
        meta && typeof meta.full_name === 'string'
          ? meta.full_name
          : meta && typeof meta.name === 'string'
            ? meta.name
            : null

      const lowered = email.toLowerCase()
      const existing = customersRef.current.find(
        (c) => c.email?.toLowerCase() === lowered,
      )
      if (existing) {
        setSession({ customerId: existing.id, email: lowered })
        if (fullName && !existing.name) {
          setCustomers((prev) =>
            prev.map((c) => (c.id === existing.id ? { ...c, name: fullName } : c)),
          )
        }
        return
      }

      const newCust: Customer = {
        id: mockId('c'),
        name: fullName,
        email: lowered,
        phone: null,
        isActive: true,
        createdAt: new Date().toISOString(),
      }
      setCustomers((prev) => [...prev, newCust])
      setSession({ customerId: newCust.id, email: lowered })
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void handle(
        session?.user?.id ?? null,
        session?.user?.email ?? null,
        (session?.user?.user_metadata as Record<string, unknown> | undefined) ?? null,
      )
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [setCustomers, setSession])

  return null
}
