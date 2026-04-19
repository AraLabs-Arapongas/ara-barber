export type BrandingInput = {
  primaryColor: string | null
  secondaryColor: string | null
  accentColor: string | null
}

/**
 * Defaults de marca Ara Barber (paleta "Warm Editorial Craft").
 * São aplicados quando o tenant não tem cor customizada (ex: onboarding inicial).
 * Valores em hex para fácil override por tenant via dashboard.
 */
export const TENANT_BRANDING_DEFAULTS = {
  primary: '#17343f', // petróleo profundo
  secondary: '#6e7d86', // petróleo dessaturado
  accent: '#b9945a', // dourado caramelo
} as const

/**
 * Texto sobre fundo escuro: creme warm (combina com paleta AraLabs).
 * Texto sobre fundo claro: marrom-café quase-preto (`--color-fg`).
 */
const FG_ON_DARK = '#fbf6ea'
const FG_ON_LIGHT = '#1a1410'

const HEX6_RE = /^#[0-9a-f]{6}$/i
const HEX3_RE = /^#[0-9a-f]{3}$/i

export function sanitizeHexColor(input: string | null | undefined): string | null {
  if (!input) return null
  const trimmed = input.trim().toLowerCase()
  if (HEX6_RE.test(trimmed)) return trimmed
  if (HEX3_RE.test(trimmed)) {
    const r = trimmed[1]
    const g = trimmed[2]
    const b = trimmed[3]
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return null
}

/**
 * Calcula luminância relativa (WCAG) e retorna texto claro ou escuro.
 * Threshold 0.5 é empírico; funciona bem para nossa paleta warm.
 */
export function contrastColor(hex: string): string {
  const clean = sanitizeHexColor(hex) ?? TENANT_BRANDING_DEFAULTS.primary
  const r = parseInt(clean.slice(1, 3), 16) / 255
  const g = parseInt(clean.slice(3, 5), 16) / 255
  const b = parseInt(clean.slice(5, 7), 16) / 255
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.55 ? FG_ON_LIGHT : FG_ON_DARK
}

/**
 * Converte branding do tenant em um mapa de CSS custom properties.
 * Sobrescreve os tokens `--brand-*` do design system (paleta default em tokens.css).
 */
export function brandingToCssVars(input: BrandingInput): Record<string, string> {
  const primary = sanitizeHexColor(input.primaryColor) ?? TENANT_BRANDING_DEFAULTS.primary
  const secondary =
    sanitizeHexColor(input.secondaryColor) ?? TENANT_BRANDING_DEFAULTS.secondary
  const accent = sanitizeHexColor(input.accentColor) ?? TENANT_BRANDING_DEFAULTS.accent

  return {
    '--brand-primary': primary,
    '--brand-primary-fg': contrastColor(primary),
    '--brand-secondary': secondary,
    '--brand-secondary-fg': contrastColor(secondary),
    '--brand-accent': accent,
    '--brand-accent-fg': contrastColor(accent),
  }
}
