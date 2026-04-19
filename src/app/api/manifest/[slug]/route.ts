import { NextResponse } from 'next/server'
import { buildManifestForSlug } from '@/lib/pwa/manifest'

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const manifest = await buildManifestForSlug(slug)

  if (!manifest) {
    return new NextResponse('Not found', { status: 404 })
  }

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=600',
    },
  })
}
