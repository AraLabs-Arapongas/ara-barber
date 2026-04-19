import { brandingToCssVars, type BrandingInput } from '@/lib/tenant/branding'

/**
 * Injeta CSS custom properties do tenant no root do documento.
 * Rendeirzado em server component — a string inline substitui defaults de tokens.css.
 *
 * IMPORTANTE: valores já passaram por `sanitizeHexColor` antes de chegar aqui —
 * o innerHTML é seguro (apenas hex validados).
 */
export function ThemeInjector({ branding }: { branding: BrandingInput }) {
  const vars = brandingToCssVars(branding)
  const css = Object.entries(vars)
    .map(([k, v]) => `${k}:${v};`)
    .join('')

  return (
    <style
      // eslint-disable-next-line react/no-danger -- valores sanitizados em brandingToCssVars
      dangerouslySetInnerHTML={{
        __html: `:root{${css}}`,
      }}
    />
  )
}
