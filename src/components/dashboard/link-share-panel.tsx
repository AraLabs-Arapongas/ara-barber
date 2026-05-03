'use client'

import { useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { copyToClipboard } from '@/lib/clipboard'

type Props = {
  /** URL que vai direto pro wizard de booking (`/book`). Compartilhada
   *  com cliente, exibida no input e codificada no QR. */
  publicUrl: string
  /** URL da home pública do tenant (`/`). Usada só pelo botão "Abrir
   *  página pública" pra owner conferir a vitrine sem cair no booking. */
  publicHomeUrl: string
  tenantSlug: string
  /** Body do template `WHATSAPP/SHARE_LINK` do tenant (ou default). Pode
   *  conter `{link}` que substituímos pela `publicUrl`. */
  shareTemplate: string
}

export function LinkSharePanel({ publicUrl, publicHomeUrl, tenantSlug, shareTemplate }: Props) {
  const [copied, setCopied] = useState(false)
  const qrRef = useRef<SVGSVGElement>(null)

  async function copy() {
    const ok = await copyToClipboard(publicUrl)
    if (!ok) return
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function downloadQR() {
    const svg = qrRef.current
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
  // depois. Aplica o template SHARE_LINK do tenant substituindo {link}.
  const messageBody = shareTemplate.replace(/\{link\}/g, publicUrl)
  const whatsappShareLink = `https://wa.me/?text=${encodeURIComponent(messageBody)}`

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="rounded-lg bg-bg-subtle px-3 py-2 font-mono text-sm break-all">
            {publicUrl}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={copy}>{copied ? 'Copiado!' : 'Copiar link'}</Button>
            <a
              href={publicHomeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'secondary' })}
            >
              Abrir página pública
            </a>
            <a
              href={whatsappShareLink}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'secondary' })}
            >
              Compartilhar no WhatsApp
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-6">
          <QRCodeSVG ref={qrRef} value={publicUrl} size={192} level="M" />
          <Button type="button" variant="secondary" onClick={downloadQR}>
            Baixar QR Code
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
