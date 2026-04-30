import { describe, expect, it } from 'vitest'
import { parseHostToSlug } from '@/lib/tenant/resolve'

describe('parseHostToSlug — admin subdomain', () => {
  it('admin.aralabs.com.br → area: platform', () => {
    expect(parseHostToSlug('admin.aralabs.com.br')).toEqual({ area: 'platform', slug: null })
  })

  it('admin.lvh.me com porta → area: platform', () => {
    expect(parseHostToSlug('admin.lvh.me:3008')).toEqual({ area: 'platform', slug: null })
  })

  it('barbearia-teste.aralabs.com.br continua tenant', () => {
    expect(parseHostToSlug('barbearia-teste.aralabs.com.br')).toEqual({
      area: 'tenant',
      slug: 'barbearia-teste',
    })
  })

  it('www continua sendo root, não platform', () => {
    expect(parseHostToSlug('www.aralabs.com.br')).toEqual({ area: 'root', slug: null })
  })
})
