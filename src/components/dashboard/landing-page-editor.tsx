'use client'

import { useRef, useState, useTransition, type FormEvent } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import {
  AlertCircle,
  CheckCircle2,
  GripVertical,
  ImageIcon,
  Trash2,
  Plus,
  Save,
  Star,
  Upload,
} from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  clearHeroImage,
  deleteTestimonial,
  updateDifferentials,
  updateHeroText,
  updateLandingBlocks,
  updateSocialLinks,
  uploadHeroImage,
  upsertTestimonial,
} from '@/app/admin/(authenticated)/actions/landing-page'
import { DIFFERENTIAL_ICONS } from '@/components/landing/differentials-block'

type BlockType =
  | 'HERO'
  | 'SERVICES'
  | 'DIFFERENTIALS'
  | 'PROFESSIONALS'
  | 'TESTIMONIALS'
  | 'CONTACT'
  | 'FINAL_CTA'

const BLOCK_LABELS: Record<BlockType, { label: string; hint: string }> = {
  HERO: { label: 'Hero', hint: 'Imagem fundo + headline + botão' },
  SERVICES: { label: 'Serviços', hint: 'Catálogo do que você oferece' },
  DIFFERENTIALS: { label: 'Diferenciais', hint: 'Por que escolher você' },
  PROFESSIONALS: { label: 'Profissionais', hint: 'Cards da sua equipe' },
  TESTIMONIALS: { label: 'Depoimentos', hint: 'O que clientes dizem' },
  CONTACT: { label: 'Contato e horário', hint: 'WhatsApp, endereço, horário' },
  FINAL_CTA: { label: 'Chamada final', hint: 'CTA + redes sociais' },
}

type BlockState = {
  blockType: BlockType
  enabled: boolean
  position: number
}

type DifferentialState = { icon: string; title: string; text: string }

type TestimonialState = {
  id: string
  author_name: string
  body: string
  rating: number
  position: number
}

type Props = {
  initialBlocks: BlockState[]
  initialHero: {
    eyebrow: string
    headlineTop: string
    headlineAccent: string
    subheadline: string
    imageUrl: string | null
    imageUrlDesktop: string | null
  }
  initialDifferentials: DifferentialState[]
  initialTestimonials: TestimonialState[]
  initialSocial: { instagram_url: string; facebook_url: string; tiktok_url: string }
}

export function LandingPageEditor({
  initialBlocks,
  initialHero,
  initialDifferentials,
  initialTestimonials,
  initialSocial,
}: Props) {
  return (
    <div className="space-y-10">
      <BlocksReorder initial={initialBlocks} />
      <HeroEditor initial={initialHero} />
      <DifferentialsEditor initial={initialDifferentials} />
      <TestimonialsEditor initial={initialTestimonials} />
      <SocialEditor initial={initialSocial} />
    </div>
  )
}

/** Status compacto pra feedback de save (sucesso/erro) — sem caixa cheia. */
function StatusInline({ msg }: { msg: { kind: 'success' | 'error'; text: string } | null }) {
  if (!msg) return null
  const Icon = msg.kind === 'success' ? CheckCircle2 : AlertCircle
  return (
    <p
      role="status"
      className={`inline-flex items-center gap-1.5 text-[0.8125rem] ${
        msg.kind === 'success' ? 'text-success' : 'text-error'
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {msg.text}
    </p>
  )
}

/** Linha padrão de ações: botão à esquerda, status à direita (não estica). */
function ActionsRow({
  children,
  msg,
}: {
  children: React.ReactNode
  msg: { kind: 'success' | 'error'; text: string } | null
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {children}
      <StatusInline msg={msg} />
    </div>
  )
}

/** Wrapper consistente: cabeçalho + card de conteúdo. Cada seção usa
 *  o mesmo container pra unificar o visual do editor. */
function EditorSection({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <header>
        <h2 className="font-display text-[1.125rem] font-semibold text-fg">{title}</h2>
        <p className="text-[0.8125rem] text-fg-muted">{hint}</p>
      </header>
      <div className="space-y-4 rounded-xl border border-border bg-surface p-4">{children}</div>
    </section>
  )
}

// ─── Blocos: toggle + drag ───────────────────────────────────────────

function BlocksReorder({ initial }: { initial: BlockState[] }) {
  const [items, setItems] = useState<BlockState[]>(
    [...initial].sort((a, b) => a.position - b.position),
  )
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setItems((arr) => {
      const oldIdx = arr.findIndex((b) => b.blockType === active.id)
      const newIdx = arr.findIndex((b) => b.blockType === over.id)
      if (oldIdx < 0 || newIdx < 0) return arr
      return arrayMove(arr, oldIdx, newIdx)
    })
  }

  function toggle(type: BlockType) {
    setItems((arr) => arr.map((b) => (b.blockType === type ? { ...b, enabled: !b.enabled } : b)))
  }

  function save() {
    setMsg(null)
    const blocks = items.map((b, i) => ({
      blockType: b.blockType,
      enabled: b.enabled,
      position: i + 1,
    }))
    startTransition(async () => {
      const res = await updateLandingBlocks({ blocks })
      if (res.ok) setMsg({ kind: 'success', text: 'Ordem salva!' })
      else setMsg({ kind: 'error', text: res.error })
    })
  }

  return (
    <EditorSection
      title="Blocos da página"
      hint="Arraste pra reordenar e use o switch pra ativar ou desativar."
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={items.map((b) => b.blockType)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-2">
            {items.map((b) => (
              <SortableBlockRow key={b.blockType} block={b} onToggle={() => toggle(b.blockType)} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <ActionsRow msg={msg}>
        <Button onClick={save} disabled={pending} size="sm">
          <Save className="h-4 w-4" aria-hidden="true" />
          Salvar ordem
        </Button>
      </ActionsRow>
    </EditorSection>
  )
}

function SortableBlockRow({ block, onToggle }: { block: BlockState; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.blockType,
  })
  const meta = BLOCK_LABELS[block.blockType]
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none p-1 text-fg-subtle hover:text-fg"
        aria-label={`Reordenar ${meta.label}`}
      >
        <GripVertical className="h-5 w-5" aria-hidden="true" />
      </button>
      <div className="flex-1">
        <p className="font-medium text-fg">{meta.label}</p>
        <p className="text-[0.75rem] text-fg-muted">{meta.hint}</p>
      </div>
      {/* Switch controlado: o thumb é descendente de sibling do <input>,
          então `peer-checked` não atinge — controla via state direto. */}
      <button
        type="button"
        role="switch"
        aria-checked={block.enabled}
        aria-label={`${block.enabled ? 'Desativar' : 'Ativar'} ${meta.label}`}
        onClick={onToggle}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          block.enabled ? 'bg-brand-primary' : 'bg-bg-subtle'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            block.enabled ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </li>
  )
}

// ─── Hero ────────────────────────────────────────────────────────────

function HeroImageSlot({
  variant,
  label,
  ratioHint,
  previewClass,
  initialUrl,
  onMessage,
}: {
  variant: 'mobile' | 'desktop'
  label: string
  ratioHint: string
  previewClass: string
  initialUrl: string | null
  onMessage: (m: { kind: 'success' | 'error'; text: string } | null) => void
}) {
  const [url, setUrl] = useState<string | null>(initialUrl)
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function pick() {
    inputRef.current?.click()
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    onMessage(null)
    const fd = new FormData()
    fd.set('file', file)
    fd.set('variant', variant)
    startTransition(async () => {
      const res = await uploadHeroImage(fd)
      if (res.ok) {
        setUrl(res.data.url)
        onMessage({ kind: 'success', text: `${label}: imagem atualizada!` })
      } else {
        onMessage({ kind: 'error', text: res.error })
      }
    })
  }

  function clear() {
    onMessage(null)
    startTransition(async () => {
      const res = await clearHeroImage(variant)
      if (res.ok) {
        setUrl(null)
        onMessage({ kind: 'success', text: `${label}: imagem removida.` })
      } else {
        onMessage({ kind: 'error', text: res.error })
      }
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[0.8125rem] font-medium text-fg">{label}</p>
        <p className="text-[0.6875rem] uppercase tracking-[0.12em] text-fg-subtle">{ratioHint}</p>
      </div>
      <div
        className={`relative overflow-hidden rounded-lg border border-border bg-bg-subtle ${previewClass}`}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-fg-subtle">
            <ImageIcon className="h-6 w-6" aria-hidden="true" />
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={onFile}
        className="sr-only"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={pick} disabled={pending}>
          <Upload className="h-4 w-4" aria-hidden="true" />
          {url ? 'Trocar' : 'Subir'}
        </Button>
        {url ? (
          <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={pending}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Remover
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function HeroEditor({
  initial,
}: {
  initial: {
    eyebrow: string
    headlineTop: string
    headlineAccent: string
    subheadline: string
    imageUrl: string | null
    imageUrlDesktop: string | null
  }
}) {
  const [eyebrow, setEyebrow] = useState(initial.eyebrow)
  const [headlineTop, setHeadlineTop] = useState(initial.headlineTop)
  const [headlineAccent, setHeadlineAccent] = useState(initial.headlineAccent)
  const [subheadline, setSubheadline] = useState(initial.subheadline)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    startTransition(async () => {
      const res = await updateHeroText({
        hero_eyebrow: eyebrow,
        home_headline_top: headlineTop,
        home_headline_accent: headlineAccent,
        hero_subheadline: subheadline,
      })
      if (res.ok) setMsg({ kind: 'success', text: 'Salvo!' })
      else setMsg({ kind: 'error', text: res.error })
    })
  }

  return (
    <EditorSection
      title="Hero"
      hint="Imagens, tarja, título e subtítulo do bloco principal. Tudo opcional — campos vazios não aparecem."
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <HeroImageSlot
            variant="mobile"
            label="Imagem mobile"
            ratioHint="9:16 retrato"
            previewClass="aspect-[9/16] max-w-[120px]"
            initialUrl={initial.imageUrl}
            onMessage={setMsg}
          />
          <HeroImageSlot
            variant="desktop"
            label="Imagem desktop"
            ratioHint="16:9 paisagem"
            previewClass="aspect-[16/9]"
            initialUrl={initial.imageUrlDesktop}
            onMessage={setMsg}
          />
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-sm font-medium text-fg">
            Tarja (eyebrow)
            <Input
              value={eyebrow}
              onChange={(e) => setEyebrow(e.target.value)}
              maxLength={80}
              placeholder='Ex: "Salão Bela Imagem" — texto pequeno acima do título. Deixe vazio pra ocultar.'
              className="mt-1"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-fg">
              Título principal
              <Input
                value={headlineTop}
                onChange={(e) => setHeadlineTop(e.target.value)}
                maxLength={120}
                placeholder='Ex: "Bela Imagem"'
                className="mt-1"
              />
            </label>
            <label className="block text-sm font-medium text-fg">
              Destaque (itálico)
              <Input
                value={headlineAccent}
                onChange={(e) => setHeadlineAccent(e.target.value)}
                maxLength={120}
                placeholder='Ex: "Centro de beleza"'
                className="mt-1"
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-fg">
            Subtítulo
            <textarea
              value={subheadline}
              onChange={(e) => setSubheadline(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="Ex: Atendimento personalizado, ambiente acolhedor, profissionais qualificados."
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-[0.9375rem] text-fg placeholder:text-fg-subtle focus:border-brand-primary focus:outline-none"
            />
          </label>
          <ActionsRow msg={msg}>
            <Button type="submit" size="sm" disabled={pending}>
              <Save className="h-4 w-4" aria-hidden="true" />
              Salvar texto
            </Button>
          </ActionsRow>
        </form>
      </div>
    </EditorSection>
  )
}

// ─── Diferenciais ────────────────────────────────────────────────────

function DifferentialsEditor({ initial }: { initial: DifferentialState[] }) {
  const [items, setItems] = useState<DifferentialState[]>(initial)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  function add() {
    if (items.length >= 6) return
    setItems((arr) => [...arr, { icon: 'sparkles', title: '', text: '' }])
  }

  function update(idx: number, field: keyof DifferentialState, value: string) {
    setItems((arr) => arr.map((d, i) => (i === idx ? { ...d, [field]: value } : d)))
  }

  function remove(idx: number) {
    setItems((arr) => arr.filter((_, i) => i !== idx))
  }

  function save() {
    setMsg(null)
    startTransition(async () => {
      const res = await updateDifferentials({ items })
      if (res.ok) setMsg({ kind: 'success', text: 'Salvo!' })
      else setMsg({ kind: 'error', text: res.error })
    })
  }

  return (
    <EditorSection title="Diferenciais" hint="Até 6 cards com ícone, título e descrição curta.">
      <div className="space-y-3">
        {items.map((d, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-border/70 bg-bg-subtle p-3">
            <div className="flex items-center gap-2">
              <select
                value={d.icon || 'sparkles'}
                onChange={(e) => update(i, 'icon', e.target.value)}
                className="rounded-md border border-border bg-bg px-2 py-1.5 text-[0.8125rem] text-fg"
              >
                {DIFFERENTIAL_ICONS.map((ic) => (
                  <option key={ic} value={ic}>
                    {ic}
                  </option>
                ))}
              </select>
              <Input
                value={d.title}
                onChange={(e) => update(i, 'title', e.target.value)}
                placeholder="Título"
                maxLength={60}
                className="flex-1"
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <textarea
              value={d.text}
              onChange={(e) => update(i, 'text', e.target.value)}
              maxLength={220}
              rows={2}
              placeholder="Descrição curta"
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-[0.875rem] text-fg placeholder:text-fg-subtle focus:border-brand-primary focus:outline-none"
            />
          </div>
        ))}
      </div>
      <ActionsRow msg={msg}>
        {items.length < 6 ? (
          <Button type="button" variant="secondary" size="sm" onClick={add}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Adicionar
          </Button>
        ) : null}
        <Button type="button" size="sm" onClick={save} disabled={pending}>
          <Save className="h-4 w-4" aria-hidden="true" />
          Salvar
        </Button>
      </ActionsRow>
    </EditorSection>
  )
}

// ─── Depoimentos ─────────────────────────────────────────────────────

function TestimonialsEditor({ initial }: { initial: TestimonialState[] }) {
  const [list, setList] = useState<TestimonialState[]>(initial)
  const [editing, setEditing] = useState<TestimonialState | null>(null)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  function startNew() {
    setEditing({ id: '', author_name: '', body: '', rating: 5, position: list.length })
  }

  function save() {
    if (!editing) return
    setMsg(null)
    startTransition(async () => {
      const res = await upsertTestimonial({
        id: editing.id || undefined,
        author_name: editing.author_name,
        body: editing.body,
        rating: editing.rating,
        position: editing.position,
      })
      if (res.ok) {
        // Atualiza lista local de forma otimista (a página reload via revalidate
        // traz id real em refresh subsequente).
        if (editing.id) {
          setList((arr) => arr.map((t) => (t.id === editing.id ? editing : t)))
        } else {
          setList((arr) => [...arr, { ...editing, id: `temp-${Date.now()}` }])
        }
        setEditing(null)
        setMsg({ kind: 'success', text: 'Salvo!' })
      } else {
        setMsg({ kind: 'error', text: res.error })
      }
    })
  }

  function remove(id: string) {
    if (!confirm('Excluir esse depoimento?')) return
    setMsg(null)
    startTransition(async () => {
      const res = await deleteTestimonial(id)
      if (res.ok) {
        setList((arr) => arr.filter((t) => t.id !== id))
        setMsg({ kind: 'success', text: 'Excluído.' })
      } else {
        setMsg({ kind: 'error', text: res.error })
      }
    })
  }

  return (
    <EditorSection title="Depoimentos" hint="Adicione comentários reais de clientes.">
      {list.length > 0 ? (
        <ul className="space-y-2">
          {list.map((t) => (
            <li
              key={t.id}
              className="flex items-start gap-3 rounded-lg border border-border/70 bg-bg-subtle p-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-brand-accent">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-3.5 w-3.5"
                      fill={i < t.rating ? 'currentColor' : 'none'}
                      strokeWidth={i < t.rating ? 0 : 1.5}
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <p className="mt-1 text-[0.875rem] text-fg">&ldquo;{t.body}&rdquo;</p>
                <p className="mt-1 text-[0.75rem] text-fg-muted">— {t.author_name}</p>
              </div>
              <div className="flex flex-col gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(t)}>
                  Editar
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(t.id)}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-bg-subtle p-4 text-center text-[0.875rem] text-fg-muted">
          Nenhum depoimento ainda.
        </p>
      )}

      {editing ? (
        <div className="space-y-3 rounded-xl border border-brand-primary/40 bg-surface p-4">
          <Input
            value={editing.author_name}
            onChange={(e) => setEditing({ ...editing, author_name: e.target.value })}
            placeholder="Nome do cliente"
            maxLength={80}
          />
          <textarea
            value={editing.body}
            onChange={(e) => setEditing({ ...editing, body: e.target.value })}
            maxLength={500}
            rows={3}
            placeholder="O que o cliente disse"
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-[0.875rem] text-fg placeholder:text-fg-subtle focus:border-brand-primary focus:outline-none"
          />
          <label className="block text-[0.8125rem] text-fg">
            Estrelas:{' '}
            <select
              value={editing.rating}
              onChange={(e) => setEditing({ ...editing, rating: Number(e.target.value) })}
              className="rounded-md border border-border bg-bg px-2 py-1 text-[0.8125rem] text-fg"
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={save} disabled={pending}>
              Salvar
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <ActionsRow msg={msg}>
          <Button type="button" variant="secondary" size="sm" onClick={startNew}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Adicionar depoimento
          </Button>
        </ActionsRow>
      )}
    </EditorSection>
  )
}

// ─── Redes sociais ───────────────────────────────────────────────────

function SocialEditor({
  initial,
}: {
  initial: { instagram_url: string; facebook_url: string; tiktok_url: string }
}) {
  const [data, setData] = useState(initial)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    startTransition(async () => {
      const res = await updateSocialLinks(data)
      if (res.ok) setMsg({ kind: 'success', text: 'Salvo!' })
      else setMsg({ kind: 'error', text: res.error })
    })
  }

  return (
    <EditorSection title="Redes sociais" hint="URLs completas (https://...).">
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm font-medium text-fg">
          Instagram
          <Input
            type="url"
            value={data.instagram_url}
            onChange={(e) => setData({ ...data, instagram_url: e.target.value })}
            placeholder="https://instagram.com/seunegocio"
            className="mt-1"
          />
        </label>
        <label className="block text-sm font-medium text-fg">
          Facebook
          <Input
            type="url"
            value={data.facebook_url}
            onChange={(e) => setData({ ...data, facebook_url: e.target.value })}
            placeholder="https://facebook.com/seunegocio"
            className="mt-1"
          />
        </label>
        <label className="block text-sm font-medium text-fg">
          TikTok
          <Input
            type="url"
            value={data.tiktok_url}
            onChange={(e) => setData({ ...data, tiktok_url: e.target.value })}
            placeholder="https://tiktok.com/@seunegocio"
            className="mt-1"
          />
        </label>
        <ActionsRow msg={msg}>
          <Button type="submit" size="sm" disabled={pending}>
            <Save className="h-4 w-4" aria-hidden="true" />
            Salvar
          </Button>
        </ActionsRow>
      </form>
    </EditorSection>
  )
}
