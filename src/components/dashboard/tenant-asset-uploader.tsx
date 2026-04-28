'use client'

import { useRef, useState, useTransition, type ChangeEvent } from 'react'
import { ImageIcon, Trash2, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import {
  clearTenantAsset,
  uploadTenantAsset,
} from '@/app/admin/(authenticated)/actions/tenant-assets'

type Props = {
  kind: 'logo' | 'favicon'
  label: string
  hint?: string
  /** URL atual (pode ser null se nunca subiu). */
  currentUrl: string | null
  /** Tamanho do preview em px. */
  previewSize?: number
}

/**
 * Upload de imagem do tenant (logo ou favicon) com preview imediato.
 *
 * UX:
 *   - Mostra preview da imagem atual (ou ícone placeholder se nenhuma).
 *   - Botão "Trocar" abre file picker; após seleção, dispara upload
 *     no server action e atualiza o preview com a URL nova.
 *   - Botão "Remover" seta NULL e mostra placeholder novamente.
 *   - Erros (tipo errado, tamanho, falha de rede) aparecem em Alert.
 *
 * O preview otimista (lê o `File` selecionado via `URL.createObjectURL`)
 * mostra a imagem ANTES do server responder, criando sensação de
 * fluidez. Quando o server confirma, troca pra URL pública oficial.
 */
export function TenantAssetUploader({
  kind,
  label,
  hint,
  currentUrl,
  previewSize = 80,
}: Props) {
  const [url, setUrl] = useState<string | null>(currentUrl)
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function pickFile() {
    inputRef.current?.click()
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite re-selecionar o mesmo arquivo
    if (!file) return
    setError(null)

    // Preview otimista enquanto o upload roda.
    const objectUrl = URL.createObjectURL(file)
    setPreviewObjectUrl(objectUrl)

    const formData = new FormData()
    formData.set('kind', kind)
    formData.set('file', file)

    startTransition(async () => {
      const result = await uploadTenantAsset(formData)
      // Libera o object URL — não precisamos mais (server respondeu).
      URL.revokeObjectURL(objectUrl)
      setPreviewObjectUrl(null)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setUrl(result.url)
    })
  }

  function onClear() {
    setError(null)
    startTransition(async () => {
      const result = await clearTenantAsset(kind)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setUrl(null)
    })
  }

  // O que mostrar no preview, em ordem de prioridade:
  //   1. Object URL (upload em andamento)
  //   2. URL salva
  //   3. Placeholder
  const previewSrc = previewObjectUrl ?? url

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-fg">{label}</label>
      {hint ? <p className="text-[0.8125rem] text-fg-muted">{hint}</p> : null}

      <div className="flex items-start gap-3">
        <div
          className="relative shrink-0 overflow-hidden rounded-xl border border-border bg-bg-subtle"
          style={{ width: previewSize, height: previewSize }}
        >
          {previewSrc ? (
            // Preview pode ser objectURL (blob) ou URL pública. Usamos
            // <img> em vez de next/image porque blob URLs não passam
            // pelo loader e algumas URLs podem não estar whitelisted.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewSrc}
              alt={`Preview ${label.toLowerCase()}`}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-fg-subtle">
              <ImageIcon className="h-6 w-6" aria-hidden="true" />
            </div>
          )}
          {pending ? (
            <div className="absolute inset-0 flex items-center justify-center bg-bg/60 text-[0.6875rem] font-medium text-fg">
              ...
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
            onChange={onFileChange}
            className="sr-only"
            aria-label={`Selecionar arquivo de ${label.toLowerCase()}`}
          />
          <Button type="button" variant="secondary" size="sm" onClick={pickFile} disabled={pending}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            {url ? 'Trocar' : 'Subir imagem'}
          </Button>
          {url ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClear}
              disabled={pending}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Remover
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}
    </div>
  )
}
