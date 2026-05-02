/**
 * Browsers (mesmo modernos) requestam /favicon.ico automaticamente além
 * do <link rel="icon"> que o Next 16 gera a partir de `app/icon.svg`.
 * Sem arquivo aqui, a Vercel retorna 403 (não 404), poluindo o console
 * do staff e do cliente.
 *
 * Redirect 308 (permanent) pro SVG resolve sem precisar manter dois
 * arquivos sincronizados. Browsers cacheiam o redirect, então o custo
 * extra é zero após primeira visita.
 */
export function GET() {
  return Response.redirect(new URL('/icon.svg', 'https://aralabs.com.br'), 308)
}
