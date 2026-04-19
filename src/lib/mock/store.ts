'use client'

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import type { z } from 'zod'

const PREFIX = 'ara-barber:mock:v1'

function storageKey(tenantSlug: string, entity: string): string {
  return `${PREFIX}:${tenantSlug}:${entity}`
}

// Cache módulo-level para estabilizar a referência retornada por getSnapshot
// (useSyncExternalStore exige snapshot estável entre chamadas se o valor não mudou).
const snapshotCache = new Map<string, { raw: string; value: unknown }>()

function readSnapshot<T>(key: string, schema: z.ZodSchema<T>, seed: () => T): T {
  if (typeof window === 'undefined') return seed()
  const raw = window.localStorage.getItem(key) ?? ''
  const cached = snapshotCache.get(key)
  if (cached && cached.raw === raw) return cached.value as T

  let value: T
  if (!raw) {
    value = seed()
  } else {
    try {
      value = schema.parse(JSON.parse(raw))
    } catch {
      value = seed()
    }
  }
  snapshotCache.set(key, { raw, value })
  return value
}

function writeSnapshot<T>(key: string, value: T): void {
  const serialized = JSON.stringify(value)
  window.localStorage.setItem(key, serialized)
  snapshotCache.set(key, { raw: serialized, value })
  // Notifica assinantes na mesma aba (o evento `storage` só dispara em outras abas).
  window.dispatchEvent(new CustomEvent('ara-barber:mock-change', { detail: { key } }))
}

export function useMockStore<T>(
  tenantSlug: string,
  entity: string,
  schema: z.ZodSchema<T>,
  seed: () => T,
): {
  data: T
  setData: (next: T | ((prev: T) => T)) => void
  hydrated: boolean
  reset: () => void
} {
  const key = storageKey(tenantSlug, entity)
  const serverFallback = useMemo(() => seed(), [seed])

  // Garantia de seed na primeira mount se storage estiver vazio.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.localStorage.getItem(key) === null) {
      writeSnapshot(key, seed())
    }
  }, [key, seed])

  const subscribe = useCallback(
    (onChange: () => void) => {
      function onStorage(e: StorageEvent) {
        if (e.key === key || e.key === null) {
          snapshotCache.delete(key)
          onChange()
        }
      }
      function onCustom(e: Event) {
        const detail = (e as CustomEvent<{ key: string }>).detail
        if (detail?.key === key) onChange()
      }
      window.addEventListener('storage', onStorage)
      window.addEventListener('ara-barber:mock-change', onCustom)
      return () => {
        window.removeEventListener('storage', onStorage)
        window.removeEventListener('ara-barber:mock-change', onCustom)
      }
    },
    [key],
  )

  const getSnapshot = useCallback(
    () => readSnapshot(key, schema, seed),
    [key, schema, seed],
  )

  const getServerSnapshot = useCallback(() => serverFallback, [serverFallback])

  const data = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setData = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = readSnapshot(key, schema, seed)
      const computed = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
      writeSnapshot(key, computed)
    },
    [key, schema, seed],
  )

  const reset = useCallback(() => {
    writeSnapshot(key, seed())
  }, [key, seed])

  const hydrated = typeof window !== 'undefined'

  return { data, setData, hydrated, reset }
}

/**
 * Remove toda a data mockada do tenant e força reload pra re-seed.
 */
export function resetTenantMockData(tenantSlug: string): void {
  if (typeof window === 'undefined') return
  const prefix = `${PREFIX}:${tenantSlug}:`
  const keys: string[] = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i)
    if (k && k.startsWith(prefix)) keys.push(k)
  }
  keys.forEach((k) => {
    window.localStorage.removeItem(k)
    snapshotCache.delete(k)
  })
  window.location.reload()
}

/**
 * Gera id curto tipo `prof_x8h2ks9` para novos itens.
 */
export function mockId(prefix: string): string {
  const rnd = Math.random().toString(36).slice(2, 9)
  return `${prefix}_${rnd}`
}
