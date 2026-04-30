import { describe, expect, it } from 'vitest'
import { ProvisionTenantInputSchema } from '@/lib/platform/provision'

describe('ProvisionTenantInputSchema', () => {
  it('aceita input válido', () => {
    const result = ProvisionTenantInputSchema.safeParse({
      slug: 'estetica-luna',
      name: 'Estética Luna',
      ownerEmail: 'maria@example.com',
      ownerName: 'Maria',
      timezone: 'America/Sao_Paulo',
    })
    expect(result.success).toBe(true)
  })

  it('rejeita slug com chars inválidos', () => {
    const result = ProvisionTenantInputSchema.safeParse({
      slug: 'Estética Luna',
      name: 'Estética Luna',
      ownerEmail: 'maria@example.com',
      ownerName: 'Maria',
    })
    expect(result.success).toBe(false)
  })

  it('rejeita email inválido', () => {
    const result = ProvisionTenantInputSchema.safeParse({
      slug: 'ok-slug',
      name: 'Ok',
      ownerEmail: 'not-an-email',
      ownerName: 'Maria',
    })
    expect(result.success).toBe(false)
  })

  it('rejeita slug muito longo', () => {
    const result = ProvisionTenantInputSchema.safeParse({
      slug: 'a'.repeat(60),
      name: 'X',
      ownerEmail: 'a@b.com',
      ownerName: 'Y',
    })
    expect(result.success).toBe(false)
  })

  it('aplica default timezone America/Sao_Paulo', () => {
    const result = ProvisionTenantInputSchema.safeParse({
      slug: 'ok',
      name: 'Ok',
      ownerEmail: 'a@b.com',
      ownerName: 'Y',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.timezone).toBe('America/Sao_Paulo')
  })
})
