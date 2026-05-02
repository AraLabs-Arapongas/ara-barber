'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import {
  checkSlugAvailabilityAction,
  createTenantAction,
  type CreateTenantState,
  type SlugCheckResult,
} from '../../actions'

/**
 * Slugify simples pt-BR: minúsculas, remove acentos via NFD,
 * troca tudo que não for [a-z0-9] por hífen, colapsa hifens consecutivos
 * e tira hífen no começo/fim. "Flor de Mirra" → "flor-de-mirra".
 */
function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

type CheckState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'result'; result: SlugCheckResult }

export function NewTenantForm() {
  const [state, action, pending] = useActionState<CreateTenantState, FormData>(
    createTenantAction,
    {},
  )
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  // `slugTouched` = staff editou o slug manualmente. Auto-fill para após
  // a primeira edição manual pra não atropelar o usuário.
  const [slugTouched, setSlugTouched] = useState(false)
  const [check, setCheck] = useState<CheckState>({ kind: 'idle' })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-fill slug a partir do nome até o staff começar a editar manualmente.
  useEffect(() => {
    if (slugTouched) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSlug(slugify(name))
  }, [name, slugTouched])

  // Live check com debounce de 350ms.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!slug) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCheck({ kind: 'idle' })
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCheck({ kind: 'checking' })
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await checkSlugAvailabilityAction(slug)
        setCheck({ kind: 'result', result })
      } catch {
        setCheck({ kind: 'idle' })
      }
    }, 350)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [slug])

  const slugAvailable =
    check.kind === 'result' && check.result.status === 'available'

  return (
    <form action={action} className="space-y-4">
      <Field label="Nome do negócio" required>
        <Input
          name="name"
          placeholder="Estética Luna"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>

      <Field label="Slug (subdomínio)" required>
        <Input
          name="slug"
          placeholder="estetica-luna"
          required
          value={slug}
          onChange={(e) => {
            setSlug(slugify(e.target.value))
            setSlugTouched(true)
          }}
          rightSlot={<SlugStatusIcon state={check} />}
        />
        <SlugHelper state={check} slug={slug} />
      </Field>

      <Field label="Nome do owner" required>
        <Input name="ownerName" placeholder="Maria Luna" required />
      </Field>

      <Field label="Email do owner" required>
        <Input name="ownerEmail" type="email" placeholder="maria@estetica.com" required />
      </Field>

      {state.error ? <p className="text-[0.8125rem] text-danger">{state.error}</p> : null}

      <Button type="submit" disabled={pending || !slugAvailable}>
        {pending ? 'Criando...' : 'Criar tenant'}
      </Button>
    </form>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.8125rem] font-medium text-fg">
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </span>
      {children}
    </label>
  )
}

function SlugStatusIcon({ state }: { state: CheckState }) {
  if (state.kind === 'checking') {
    return <Loader2 className="h-4 w-4 animate-spin text-fg-subtle" aria-hidden="true" />
  }
  if (state.kind === 'result') {
    if (state.result.status === 'available') {
      return <Check className="h-4 w-4 text-success" aria-hidden="true" />
    }
    return <X className="h-4 w-4 text-danger" aria-hidden="true" />
  }
  return null
}

function SlugHelper({ state, slug }: { state: CheckState; slug: string }) {
  // URL preview sempre que tiver slug, mesmo enquanto checa.
  const urlPreview = slug ? `https://${slug}.aralabs.com.br` : null

  if (state.kind === 'result') {
    if (state.result.status === 'taken') {
      return <p className="mt-1 text-[0.75rem] text-danger">Esse slug já está em uso.</p>
    }
    if (state.result.status === 'reserved') {
      return (
        <p className="mt-1 text-[0.75rem] text-danger">
          Esse slug é reservado da plataforma.
        </p>
      )
    }
    if (state.result.status === 'invalid') {
      return <p className="mt-1 text-[0.75rem] text-danger">{state.result.reason}</p>
    }
    // available
    return (
      <p className="mt-1 text-[0.75rem] text-fg-muted">
        ✓ Vai virar{' '}
        <a
          href={urlPreview ?? '#'}
          target="_blank"
          rel="noreferrer noopener"
          className="text-fg underline-offset-2 hover:underline"
        >
          {urlPreview}
        </a>
      </p>
    )
  }
  return urlPreview ? (
    <p className="mt-1 text-[0.75rem] text-fg-muted">Vai virar {urlPreview}</p>
  ) : null
}
