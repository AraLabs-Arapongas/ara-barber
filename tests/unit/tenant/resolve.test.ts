import { describe, it, expect } from 'vitest'
import { parseHostToSlug } from '@/lib/tenant/resolve'

describe('parseHostToSlug', () => {
  it('extrai slug de subdomínio de produção', () => {
    expect(parseHostToSlug('barbearia-joao.aralabs.com.br')).toEqual({
      area: 'tenant',
      slug: 'barbearia-joao',
    })
  })

  it('extrai slug de subdomínio lvh.me (dev)', () => {
    expect(parseHostToSlug('barbearia-joao.lvh.me')).toEqual({
      area: 'tenant',
      slug: 'barbearia-joao',
    })
  })

  it('identifica platform admin por host exato', () => {
    expect(parseHostToSlug('admin.aralabs.com.br')).toEqual({
      area: 'platform',
      slug: null,
    })
  })

  it('ignora porta', () => {
    expect(parseHostToSlug('barbearia-joao.lvh.me:3008')).toEqual({
      area: 'tenant',
      slug: 'barbearia-joao',
    })
  })

  it('é case-insensitive', () => {
    expect(parseHostToSlug('MINHA-LOJA.LVH.ME')).toEqual({
      area: 'tenant',
      slug: 'minha-loja',
    })
  })

  it('retorna root quando host não matcha domínio conhecido', () => {
    expect(parseHostToSlug('localhost:3008')).toEqual({ area: 'root', slug: null })
    expect(parseHostToSlug('aralabs.com.br')).toEqual({ area: 'root', slug: null })
  })

  it('rejeita slug inválido (underscore, hífen no início)', () => {
    expect(parseHostToSlug('-foo.aralabs.com.br')).toEqual({ area: 'root', slug: null })
    expect(parseHostToSlug('foo_bar.aralabs.com.br')).toEqual({ area: 'root', slug: null })
  })

  it('aceita slug de 1 caractere', () => {
    expect(parseHostToSlug('a.lvh.me')).toEqual({ area: 'tenant', slug: 'a' })
  })
})
