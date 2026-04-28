# Futuro do ara-agenda

> Produto vivo. Cada item nasce como ideia, vira decisão, vira plano,
> vira código. Atualize ao longo das conversas — não deixe acumular.
>
> **Não confundir com:**
> - `docs/superpowers/plans/` — planos executáveis (checklist por fase).
> - `docs/superpowers/specs/` — design técnico de feature.
>
> Este doc é o nível acima: pensamento de produto, decisões adiadas,
> backlog priorizado. Quando algo daqui virar plano executável, criar
> doc em `plans/` e linkar aqui.

---

## Decisões tomadas

_Cronológico inverso (mais recente primeiro). Cada item: data, decisão, razão curta, link pro commit/PR se houver._

- **2026-04-28 — Booking rules aplicadas no runtime.**
  `min_advance_hours` + `slot_interval_minutes` agora enforçados no
  `computeSlots()` (cliente respeita; staff respeita só o interval —
  pode bookar walk-in pra agora). `customer_can_cancel` validado em
  `cancelCustomerAppointment()`. Era TODO declarado em
  `booking-rules.ts:43`.

- **2026-04-28 — Sentry instalado pro monitoring de erros prod.**
  Free tier (5K errors/mês). Captura client + server + edge errors,
  source maps via `SENTRY_AUTH_TOKEN` quando setado. Sem performance
  tracing (Vercel Analytics cobre). Sem replay (custa quota separada).

- **2026-04-28 — Termos de uso criados + política de privacidade
  reforçada (LGPD).** Novas rotas `/termos-uso` + atualização de
  `/politica-privacidade` com bases legais, retenção, transferência
  internacional, cookies, DPO. Consent checkbox implícito no botão
  "Confirmar reserva" do wizard.

- **2026-04-28 — Script `pnpm provision-tenant` pra novos tenants.**
  Cria tenant + business_hours defaults + auth user + user_profile
  BUSINESS_OWNER + envia reset de senha. Substitui SQL manual via MCP.

- **2026-04-28 — Mobile nativo: não fazer no horizonte previsível.**
  PWA atual cobre 90% dos casos (push, install prompt, wake lock,
  câmera). Custo de manter 2-3 stacks paralelas + fee de app store
  (15-30% em in-app purchase) não compensa pro segmento SMB Brasil.
  Revisitar só se: (a) 1000+ tenants pagantes pedindo, ou (b)
  feature específica que **só** funciona nativo (NFC, hardware POS).

- **2026-04-28 — Wizard cliente single-page substitui multi-rota `/book/*`.**
  Padrão alinhado com wizard manual do staff. Login postergado pro
  step "Confirmar". Commit `b9bac0d`.

---

## Backlog priorizado (próximos 3-6 meses pós-MVP)

### Tier 1 — Alto valor, baixo-médio esforço

- **Audit log de mutations sensíveis.**
  Cancelamento de appointment, edit de regras, mudança de role,
  exclusão de cliente/profissional. Épico 9 incompleto. Importante
  pra "quem fez o quê" em piloto. Esforço: ~3-4h (migration + helper
  + chamadas nas mutations).

- **Reabilitar Playwright em CI.**
  Hoje E2E desativado (épico 10). Regressão silenciosa é risco real
  conforme produto cresce. Esforço: ~1-2h, mas exige fazer testes
  passarem primeiro.

### Tier 2 — Alto valor, alto esforço

- **Pagamento online + sinal antecipado (PIX).**
  Único feature que paga a si mesmo: reduz no-show drasticamente +
  gera transactional fee. Prioridade #1 de Fase 2. Schema já tem
  `services.deposit_required`, `deposit_value_cents`, `deposit_type`,
  `deposit_percentage` — precisa wiring + integração com PSP (Stripe,
  Mercado Pago, Asaas).

- **WhatsApp dispatch real via Z-API/Evolution API.**
  Status atual: edge function `on-appointment-event` aplica template
  mas WhatsApp só monta `wa.me/...?text=...` (cliente abre manual).
  Tradeoff custo/risco analisado:
    - **Z-API/Evolution** (~R$ 50-150/mês fixo): usa número que dono
      já anuncia, sem aprovar templates, risco de ban Meta baixo se
      respeitar volume + opt-in. **Recomendado pro beachhead.**
    - **WhatsApp Business API oficial** (Meta direto ou BSP como
      Twilio): R$ 0,05-0,30 por mensagem, profissional, mas templates
      precisam aprovação Meta. Vale só pra tenants grandes ou white-label.
  **Inclui também:** quando agendamento for criado/confirmado, mandar
  WhatsApp de confirmação (mesmo conteúdo que o email hoje) com link
  `.ics` ou web calendar (`https://calendar.google.com/calendar/render?action=TEMPLATE&...`)
  pro cliente adicionar na agenda dele.

- **Lembrete 24h + 2h via WhatsApp.**
  Estrutura existe (`appointments.reminder_24h_sent_at`,
  `reminder_2h_sent_at`), falta dispatch real. Casa com item acima.

### Tier 3 — Marginal / experimental

- **Programa de fidelidade simples** (cliente N reservas → desconto
  no próximo). Forte retenção. Esforço médio.

- **Marketing campaigns** (envio em massa, segmentação por última
  visita / vertical). Útil pra época baixa. Custo de mensagens.

- **Múltiplas unidades** (rede com tenant-pai). Mexe em RLS, queries,
  billing — alto esforço, segmento menor.

- **Branding white-label completo.** Campo `tenants.custom_domain` já
  existe no schema, falta wiring (cert SSL automático, DNS
  validation). Apelo principalmente de vaidade do dono.

---

## Ideias em aberto

_Brainstorm dump. Move pra Backlog quando virar concreto, ou pra "Não vamos fazer" quando descartar._

- **Modelo de pricing:** flat tier (free/pro/business) vs per-feature
  add-on (à la carte). Sem dado de mercado ainda — entrevistar
  tenants piloto antes de decidir.
- **Integração Google Calendar / iCal pro staff** — sincronizar
  agenda do staff com Google. Útil pra dono que já vive no Calendar.
- **Relatórios avançados** (cohort, LTV, churn). Utilidade duvidosa
  pro SMB que olha caixa do dia. Talvez só aparece quando subir pra
  segmento médio.
- **Auto-confirmação de reservas** (configurável: cliente cria →
  já vira CONFIRMED automaticamente, sem precisar staff aprovar).
  Reduz fricção pra negócios de alto volume / baixa criticidade.

---

## Não vamos fazer (com razão)

- **Mobile nativo** (decisão 2026-04-28). Custo > benefício; PWA cobre.
- **Multi-idioma / multi-moeda.** Escopo Brasil. Reabrir só se for
  expandir LATAM/global.
- **WhatsApp Business API oficial pra todos os tiers.** Caro pra
  volume baixo do beachhead. Z-API é o caminho. Reservar oficial pra
  tenants enterprise futuros.

---

## Conversas relevantes

_Links pra discussões importantes em PRs, issues, ou notas em sessões anteriores._

- 2026-04-27 — análise de WhatsApp dispatch (3 vias, Z-API recomendado) e premium tiers (sessão Claude).
