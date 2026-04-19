import type { Metadata, Viewport } from 'next'
import { Fraunces, Figtree } from 'next/font/google'
import './globals.css'

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  axes: ['SOFT', 'opsz'],
  style: ['normal', 'italic'],
  display: 'swap',
})

const figtree = Figtree({
  variable: '--font-figtree',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Ara Barber',
  description: 'Agendamento e operação para barbearias e salões.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#17343F',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${figtree.variable}`}>
      <body>{children}</body>
    </html>
  )
}
