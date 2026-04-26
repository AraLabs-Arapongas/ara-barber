/**
 * Empty state da Agenda — só ilustração + texto. As ações (Novo agendamento,
 * Copiar link) ficam no header da página, não duplicadas aqui.
 */
export function AgendaEmptyState() {
  return (
    <div className="my-8 flex flex-col items-center justify-center gap-3 px-4 py-8 text-center">
      <EmptyCalendarIllustration className="h-32 w-32 text-fg-muted/40" />
      <div>
        <p className="font-display text-[1.0625rem] font-semibold text-fg">
          Nenhum agendamento neste dia.
        </p>
        <p className="mt-1 text-[0.875rem] text-fg-muted">
          Use o <span className="font-medium text-fg">+</span> no topo pra adicionar manualmente, ou
          compartilhe seu link pra clientes agendarem sozinhos.
        </p>
      </div>
    </div>
  )
}

function EmptyCalendarIllustration({ className }: { className?: string }) {
  // Estilo line-art monocromático, calendário com face neutra (•_•) +
  // sparkles e dots ao redor pra dar vibe friendly.
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Sparkles laterais — esquerda */}
      <path d="M30 60 L20 55" />
      <path d="M30 75 L18 75" />
      <path d="M30 90 L20 95" />
      {/* Sparkles laterais — direita */}
      <path d="M170 60 L180 55" />
      <path d="M170 75 L182 75" />
      <path d="M170 90 L180 95" />

      {/* Sombra */}
      <ellipse cx="100" cy="172" rx="40" ry="3" stroke="none" fill="currentColor" opacity="0.3" />

      {/* Calendário (corpo) */}
      <rect x="50" y="50" width="100" height="110" rx="8" />
      {/* Anéis no topo */}
      <line x1="70" y1="42" x2="70" y2="58" />
      <line x1="130" y1="42" x2="130" y2="58" />
      {/* Linha do header */}
      <line x1="50" y1="75" x2="150" y2="75" />

      {/* Face neutra (•_•) */}
      <circle cx="80" cy="105" r="3" fill="currentColor" stroke="none" />
      <circle cx="120" cy="105" r="3" fill="currentColor" stroke="none" />
      <line x1="88" y1="130" x2="112" y2="130" />

      {/* Dots e X marks decorativos */}
      <circle cx="40" cy="130" r="2" fill="currentColor" stroke="none" />
      <circle cx="165" cy="135" r="2" fill="currentColor" stroke="none" />
      <path d="M35 150 L41 150 M38 147 L38 153" />
      <path d="M165 115 L171 115 M168 112 L168 118" />
    </svg>
  )
}
