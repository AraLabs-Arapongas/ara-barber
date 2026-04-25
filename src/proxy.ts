import { NextResponse, type NextRequest } from 'next/server'
import { parseHostToSlug, resolveTenantIdBySlug } from '@/lib/tenant/resolve'

// Janela de redirect /salon/* → /admin/* pra preservar bookmarks/links externos
// pós-rebrand (2026-04-26). Remover após 2026-05-26.
const SALON_REDIRECT_DEADLINE = new Date('2026-05-26T00:00:00Z')

export async function proxy(req: NextRequest) {
  const host = req.headers.get('host') ?? ''
  const parsed = parseHostToSlug(host)

  // Redirect transitório: rotas antigas /salon/* → /admin/*
  if (
    Date.now() < SALON_REDIRECT_DEADLINE.getTime() &&
    req.nextUrl.pathname.startsWith('/salon')
  ) {
    const newUrl = req.nextUrl.clone()
    newUrl.pathname = req.nextUrl.pathname.replace(/^\/salon/, '/admin')
    return NextResponse.redirect(newUrl, 302)
  }

  const res = NextResponse.next()
  res.headers.set('x-ara-area', parsed.area)
  res.headers.set('x-ara-host', host)

  if (parsed.area === 'tenant' && parsed.slug) {
    const tenantId = await resolveTenantIdBySlug(parsed.slug)
    if (tenantId) {
      res.headers.set('x-ara-tenant-id', tenantId)
      res.headers.set('x-ara-tenant-slug', parsed.slug)
    } else {
      // Subdomínio válido em formato mas sem tenant correspondente.
      // Passa pro Next renderizar `src/app/not-found.tsx` com o design system.
      res.headers.set('x-ara-tenant-missing', '1')
    }
  }

  return res
}

export const config = {
  matcher: [
    /*
     * Evita rodar o proxy em assets estáticos, otimização de imagem,
     * favicon e route handler de health (quando houver).
     */
    '/((?!_next/static|_next/image|favicon.ico|api/health).*)',
  ],
}
