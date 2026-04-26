'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type ConfirmBase = {
  title: ReactNode
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
}

export type ConfirmOptions = ConfirmBase & {
  destructive?: boolean
}

export type PromptOptions = ConfirmBase & {
  placeholder?: string
  defaultValue?: string
  /** Se true, resolve com string sempre (campo obrigatório). Default: false. */
  required?: boolean
  maxLength?: number
  destructive?: boolean
}

export type TypedConfirmOptions = ConfirmBase & {
  /** Palavra/frase que o usuário precisa digitar exatamente pra habilitar o CTA. */
  phrase: string
  destructive?: boolean
}

type DialogState =
  | ({ kind: 'confirm' } & ConfirmOptions)
  | ({ kind: 'prompt' } & PromptOptions)
  | ({ kind: 'typed' } & TypedConfirmOptions)
  | null

type Resolver = ((value: boolean) => void) | ((value: string | null) => void)

type ConfirmCtx = {
  openConfirm: (opts: ConfirmOptions) => Promise<boolean>
  openPrompt: (opts: PromptOptions) => Promise<string | null>
  openTyped: (opts: TypedConfirmOptions) => Promise<boolean>
}

const Ctx = createContext<ConfirmCtx | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState>(null)
  const resolverRef = useRef<Resolver | null>(null)
  const [fieldValue, setFieldValue] = useState('')

  const close = useCallback((value: boolean | string | null) => {
    const resolver = resolverRef.current
    resolverRef.current = null
    setState(null)
    setFieldValue('')
    if (resolver) (resolver as (v: unknown) => void)(value)
  }, [])

  const openConfirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolverRef.current = resolve as Resolver
        setState({ kind: 'confirm', ...opts })
      }),
    [],
  )

  const openPrompt = useCallback(
    (opts: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        resolverRef.current = resolve as Resolver
        setFieldValue(opts.defaultValue ?? '')
        setState({ kind: 'prompt', ...opts })
      }),
    [],
  )

  const openTyped = useCallback(
    (opts: TypedConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolverRef.current = resolve as Resolver
        setFieldValue('')
        setState({ kind: 'typed', ...opts })
      }),
    [],
  )

  const ctx = useMemo<ConfirmCtx>(
    () => ({ openConfirm, openPrompt, openTyped }),
    [openConfirm, openPrompt, openTyped],
  )

  const dismiss = () => {
    if (!state) return
    if (state.kind === 'prompt') close(null)
    else close(false)
  }

  const handleConfirm = () => {
    if (!state) return
    if (state.kind === 'prompt') close(fieldValue)
    else close(true)
  }

  const destructive = state && 'destructive' in state ? Boolean(state.destructive) : false
  const confirmLabel = state?.confirmLabel ?? (state?.kind === 'prompt' ? 'OK' : 'Confirmar')
  const cancelLabel = state?.cancelLabel ?? 'Cancelar'
  const canConfirm =
    state?.kind === 'typed'
      ? fieldValue.trim().toUpperCase() === state.phrase.trim().toUpperCase()
      : state?.kind === 'prompt'
        ? !state.required || fieldValue.trim().length > 0
        : true

  return (
    <Ctx.Provider value={ctx}>
      {children}
      <BottomSheet
        open={state !== null}
        onClose={dismiss}
        title={state?.title}
        description={state?.description}
      >
        {state ? (
          <div className="space-y-4">
            {state.kind === 'prompt' ? (
              <Input
                autoFocus
                value={fieldValue}
                onChange={(e) => setFieldValue(e.target.value)}
                placeholder={state.placeholder}
                maxLength={state.maxLength}
              />
            ) : null}

            {state.kind === 'typed' ? (
              <Input
                autoFocus
                value={fieldValue}
                onChange={(e) => setFieldValue(e.target.value)}
                placeholder={`Digite "${state.phrase}"`}
                aria-label={`Digite "${state.phrase}" para confirmar`}
                autoComplete="off"
                autoCapitalize="characters"
              />
            ) : null}

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="secondary" fullWidth onClick={dismiss}>
                {cancelLabel}
              </Button>
              <Button
                type="button"
                fullWidth
                variant={destructive ? 'destructive' : 'primary'}
                disabled={!canConfirm}
                onClick={handleConfirm}
              >
                {confirmLabel}
              </Button>
            </div>
          </div>
        ) : null}
      </BottomSheet>
    </Ctx.Provider>
  )
}

type ConfirmFn = {
  (opts: ConfirmOptions): Promise<boolean>
  prompt: (opts: PromptOptions) => Promise<string | null>
  typed: (opts: TypedConfirmOptions) => Promise<boolean>
}

/**
 * Hook imperativo tipo `window.confirm`. Retorna Promise<boolean> pra confirm/typed,
 * Promise<string | null> pra prompt (null = cancelou).
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(Ctx)
  if (!ctx) {
    throw new Error('useConfirm deve ser usado dentro de <ConfirmProvider>.')
  }
  const fn = useMemo<ConfirmFn>(
    () =>
      Object.assign((opts: ConfirmOptions) => ctx.openConfirm(opts), {
        prompt: (opts: PromptOptions) => ctx.openPrompt(opts),
        typed: (opts: TypedConfirmOptions) => ctx.openTyped(opts),
      }),
    [ctx],
  )
  return fn
}
