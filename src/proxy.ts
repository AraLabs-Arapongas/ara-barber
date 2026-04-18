import { NextResponse, type NextRequest } from 'next/server'

const PLATFORM_HOST = process.env.NEXT_PUBLIC_PLATFORM_HOST ?? 'admin.aralabs.com.br'
const APP_BASE_HOST = process.env.NEXT_PUBLIC_APP_BASE_HOST ?? 'aralabs.com.br'
const DEV_BASE_HOST = process.env.NEXT_PUBLIC_DEV_BASE_HOST ?? 'lvh.me'

function resolveArea(host: string): 'platform' | 'tenant' | 'root' {
  if (host === PLATFORM_HOST) return 'platform'
  if (host.endsWith(`.${APP_BASE_HOST}`)) return 'tenant'
  if (host.endsWith(`.${DEV_BASE_HOST}`)) return 'tenant'
  return 'root'
}

export function proxy(req: NextRequest) {
  const host = req.headers.get('host') ?? ''
  const area = resolveArea(host.split(':')[0])

  const res = NextResponse.next()
  res.headers.set('x-ara-area', area)
  res.headers.set('x-ara-host', host)
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health).*)'],
}
