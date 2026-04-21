'use client'

import type { AgendaAppointment } from '@/lib/appointments/queries'

const cache = new Map<string, AgendaAppointment>()

export function cacheAppointments(rows: AgendaAppointment[]): void {
  for (const r of rows) cache.set(r.id, r)
}

export function getCachedAppointment(id: string): AgendaAppointment | undefined {
  return cache.get(id)
}
