import { describe, it, expect } from 'vitest'
import { canTransition } from '@/lib/appointments/status-rules'

const baseCtx = {
  actor: 'staff' as const,
  now: new Date('2026-05-01T10:00:00Z'),
  startAt: new Date('2026-05-01T14:00:00Z'),
  endAt: new Date('2026-05-01T14:30:00Z'),
  cancellationWindowHours: 2,
}

describe('canTransition', () => {
  it('staff confirma SCHEDULED → CONFIRMED', () => {
    expect(canTransition('SCHEDULED', 'CONFIRMED', baseCtx)).toEqual({ ok: true })
  })

  it('customer não pode confirmar', () => {
    const r = canTransition('SCHEDULED', 'CONFIRMED', { ...baseCtx, actor: 'customer' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('staff')
  })

  it('cliente cancela dentro da janela', () => {
    const ctx = {
      ...baseCtx,
      actor: 'customer' as const,
      now: new Date('2026-05-01T11:00:00Z'),
    }
    expect(canTransition('CONFIRMED', 'CANCELED', ctx)).toEqual({ ok: true })
  })

  it('cliente não cancela fora da janela', () => {
    const ctx = {
      ...baseCtx,
      actor: 'customer' as const,
      now: new Date('2026-05-01T13:30:00Z'),
    }
    const r = canTransition('CONFIRMED', 'CANCELED', ctx)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('2h antes')
  })

  it('staff cancela ignorando janela', () => {
    const ctx = { ...baseCtx, now: new Date('2026-05-01T13:55:00Z') }
    expect(canTransition('CONFIRMED', 'CANCELED', ctx)).toEqual({ ok: true })
  })

  it('NO_SHOW só depois do start_at', () => {
    const r1 = canTransition('CONFIRMED', 'NO_SHOW', baseCtx)
    expect(r1.ok).toBe(false)
    if (!r1.ok) expect(r1.reason).toContain('horário passar')
    const after = { ...baseCtx, now: new Date('2026-05-01T14:05:00Z') }
    expect(canTransition('CONFIRMED', 'NO_SHOW', after)).toEqual({ ok: true })
  })

  it('COMPLETED só depois de end_at', () => {
    const mid = { ...baseCtx, now: new Date('2026-05-01T14:15:00Z') }
    const r = canTransition('CONFIRMED', 'COMPLETED', mid)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('serviço terminar')
    const after = { ...baseCtx, now: new Date('2026-05-01T14:35:00Z') }
    expect(canTransition('CONFIRMED', 'COMPLETED', after)).toEqual({ ok: true })
  })

  it('terminal states não voltam', () => {
    expect(canTransition('COMPLETED', 'CONFIRMED', baseCtx).ok).toBe(false)
    expect(canTransition('CANCELED', 'SCHEDULED', baseCtx).ok).toBe(false)
    expect(canTransition('NO_SHOW', 'CONFIRMED', baseCtx).ok).toBe(false)
  })
})
