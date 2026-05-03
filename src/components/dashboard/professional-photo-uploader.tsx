'use client'

import { useRef, useState, useTransition, type ChangeEvent } from 'react'
import { Trash2, Upload, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import {
  clearProfessionalPhoto,
  uploadProfessionalPhoto,
} from '@/app/admin/(authenticated)/actions/professional-photo'

type Props = {
  professionalId: string
  /** "DR" / "M" — fallback visual quando sem foto. */
  initials: string
  currentUrl: string | null
}

/**
 * Upload da foto do profissional com preview otimista.
 * Sem foto, mostra iniciais em pílula da cor primária do tenant
 * (consistente com o card no landing público).
 */
export function ProfessionalPhotoUploader({ professionalId, initials, currentUrl }: Props) {
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
    e.target.value = ''
    if (!file) return
    setError(null)

    const objectUrl = URL.createObjectURL(file)
    setPreviewObjectUrl(objectUrl)

    const formData = new FormData()
    formData.set('professionalId', professionalId)
    formData.set('file', file)

    startTransition(async () => {
      const result = await uploadProfessionalPhoto(formData)
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
      const result = await clearProfessionalPhoto(professionalId)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setUrl(null)
    })
  }

  const previewSrc = previewObjectUrl ?? url

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-brand-primary text-brand-primary-fg">
          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewSrc}
              alt="Foto do profissional"
              className="h-full w-full object-cover"
            />
          ) : initials ? (
            <div className="flex h-full w-full items-center justify-center font-display text-[1.5rem] font-semibold">
              {initials}
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <User className="h-7 w-7" aria-hidden="true" strokeWidth={1.5} />
            </div>
          )}
          {pending ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-[0.6875rem] font-medium text-white">
              ...
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={onFileChange}
            className="sr-only"
            aria-label="Selecionar foto do profissional"
          />
          <Button type="button" variant="secondary" size="sm" onClick={pickFile} disabled={pending}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            {url ? 'Trocar foto' : 'Subir foto'}
          </Button>
          {url ? (
            <Button type="button" variant="ghost" size="sm" onClick={onClear} disabled={pending}>
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
