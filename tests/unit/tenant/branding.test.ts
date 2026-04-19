import { describe, it, expect } from 'vitest'
import {
  brandingToCssVars,
  contrastColor,
  sanitizeHexColor,
  TENANT_BRANDING_DEFAULTS,
} from '@/lib/tenant/branding'

describe('sanitizeHexColor', () => {
  it('aceita #rrggbb', () => {
    expect(sanitizeHexColor('#ab34cd')).toBe('#ab34cd')
  })

  it('aceita #RGB e expande', () => {
    expect(sanitizeHexColor('#ABC')).toBe('#aabbcc')
  })

  it('normaliza para lowercase', () => {
    expect(sanitizeHexColor('#AABBCC')).toBe('#aabbcc')
  })

  it('retorna null para formato inválido', () => {
    expect(sanitizeHexColor('red')).toBe(null)
    expect(sanitizeHexColor('#zzz')).toBe(null)
    expect(sanitizeHexColor('#12345')).toBe(null)
    expect(sanitizeHexColor(null)).toBe(null)
    expect(sanitizeHexColor('')).toBe(null)
  })
})

describe('contrastColor', () => {
  it('retorna texto claro sobre fundo escuro', () => {
    expect(contrastColor('#000000')).toBe('#fbf6ea')
  })

  it('retorna texto escuro sobre fundo claro', () => {
    expect(contrastColor('#ffffff')).toBe('#1a1410')
  })

  it('funciona com tom médio (petróleo → texto claro)', () => {
    expect(contrastColor('#17343f')).toBe('#fbf6ea')
  })

  it('funciona com tom médio (dourado → texto escuro)', () => {
    expect(contrastColor('#b9945a')).toBe('#1a1410')
  })

  it('fallback quando hex inválido', () => {
    // cai no default primary
    expect(contrastColor('abacate')).toBe('#fbf6ea')
  })
})

describe('brandingToCssVars', () => {
  it('usa defaults Ara Barber quando todas as cores são nulas', () => {
    const vars = brandingToCssVars({
      primaryColor: null,
      secondaryColor: null,
      accentColor: null,
    })
    expect(vars['--brand-primary']).toBe(TENANT_BRANDING_DEFAULTS.primary)
    expect(vars['--brand-accent']).toBe(TENANT_BRANDING_DEFAULTS.accent)
    expect(vars['--brand-primary-fg']).toBeTruthy()
  })

  it('aplica cor customizada com contraste calculado', () => {
    const vars = brandingToCssVars({
      primaryColor: '#ff0000',
      secondaryColor: null,
      accentColor: null,
    })
    expect(vars['--brand-primary']).toBe('#ff0000')
    expect(vars['--brand-primary-fg']).toBe('#fbf6ea') // vermelho puro = fundo escuro
  })

  it('sanitiza hex inválido caindo no default', () => {
    const vars = brandingToCssVars({
      primaryColor: 'not-a-color',
      secondaryColor: null,
      accentColor: null,
    })
    expect(vars['--brand-primary']).toBe(TENANT_BRANDING_DEFAULTS.primary)
  })

  it('expande hex curto (#f00 → #ff0000)', () => {
    const vars = brandingToCssVars({
      primaryColor: '#f00',
      secondaryColor: null,
      accentColor: null,
    })
    expect(vars['--brand-primary']).toBe('#ff0000')
  })
})
