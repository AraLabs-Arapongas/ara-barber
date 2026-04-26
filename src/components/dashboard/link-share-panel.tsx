'use client'

import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

type Props = {
  publicUrl: string
  tenantSlug: string
}

export function LinkSharePanel({ publicUrl, tenantSlug }: Props) {
  const [copied, setCopied] = useState(false)

  function copy() {
    void navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function downloadQR() {
    const svg = document.getElementById('qr-svg') as SVGSVGElement | null
    if (!svg) return
    const data = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([data], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `qr-${tenantSlug}.svg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // wa.me sem número aceita só ?text= — o usuário escolhe o destinatário
  // depois. Em fase posterior (C5-3) podemos puxar template de tenant_message_templates.
  const whatsappShareLink = `https://wa.me/?text=${encodeURIComponent(
    `Oi! Agora você pode agendar comigo direto por aqui: ${publicUrl}`,
  )}`

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="rounded-lg bg-bg-subtle px-3 py-2 font-mono text-sm break-all">
            {publicUrl}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={copy}>{copied ? 'Copiado!' : 'Copiar link'}</Button>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="secondary">
                Abrir página pública
              </Button>
            </a>
            <a href={whatsappShareLink} target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="secondary">
                Compartilhar no WhatsApp
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-6">
          <QRCodeSVG id="qr-svg" value={publicUrl} size={192} level="M" />
          <Button type="button" variant="secondary" onClick={downloadQR}>
            Baixar QR Code
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
