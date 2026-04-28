# ara-agenda — Documento de produto

> Single source of truth sobre o ara-agenda pra contextos de **marketing/divulgação**
> e **técnico** (cross-project). Lido por skills do Claude Code (`aralabs-araagenda`)
> quando agente em outro projeto AraLabs precisa entender o produto.
>
> **Mantenha curto e fiel.** Atualize em commits no mesmo PR que mudar comportamento
> visível. Quando algo virar plano executável, criar em `docs/superpowers/plans/` e
> referenciar aqui.

---

## 1. One-liner

Agenda online + presença digital pra qualquer SMB que vende tempo por horário —
mobile-first, multi-tenant, sem caderno e sem WhatsApp manual.

## 2. Pra quem é

**Beachhead atual:** beleza & estética (barbearia, salão, estética).
**Vertical-agnóstico por design:** schema, copy e arquitetura permanecem neutros pra
expandir pra clínicas, oficinas, mecânicos, fisioterapeutas, qualquer SMB que
agenda tempo.

**Tamanho do negócio:** 1-10 profissionais. Acima disso vai pra outro segmento
(rede, cadeia) — fora do escopo Fase 1.

## 3. Problema que resolve

- Agenda no caderno ou planilha → conflito, esquecimento, no-show.
- WhatsApp manual pra confirmação → consome tempo do dono / recepção.
- Cliente liga e não atende → perde reserva.
- Sem presença digital → cliente não acha o negócio no Google.
- Múltiplos profissionais → agenda compartilhada vira caos.

## 4. Como funciona em 3 passos

1. **Setup rápido (15 min):** dono cria conta, cadastra serviços, profissionais e
   horário de funcionamento.
2. **Link público:** `<seunegocio>.aralabs.com.br` vira a landing oficial. Cliente
   agenda em 4 cliques (serviço → profissional → data/hora → confirmar).
3. **Operação diária:** staff vê agenda em tempo real, confirma/cancela; cliente
   recebe email de confirmação.

## 5. Diferenciais

- **Mobile-first** sempre — toda UI nasce pensada em celular antes do desktop.
- **PWA** com install prompt, push notifications, modo operação.
- **Branding por negócio** — cores, logo, headline customizadas, sem cara genérica.
- **Multi-tenant isolado por RLS** (Row-Level Security do Postgres) — defense in
  depth, dados de um negócio nunca cruzam com outro.
- **Subdomínio próprio** por negócio (`<slug>.aralabs.com.br`) — transmite
  profissionalismo, ranqueia separado.
- **Português brasileiro nativo** — copy, formatação, fuso horário, telefone, valor.
- **Sem cara de SaaS gringo** — design discreto, conteúdo > formulário.

## 6. Features atuais (Fase 1, MVP)

- ✅ Cadastro de serviços, profissionais, vínculo serviço↔profissional.
- ✅ Horário de funcionamento por dia da semana, jornada por profissional,
  bloqueios pontuais (férias, pausas).
- ✅ Wizard de agendamento online (single-page, deep-link friendly).
- ✅ Login customer via OTP por email (8 dígitos) ou Google.
- ✅ Agenda staff em tempo real (Supabase Realtime).
- ✅ Status machine: SCHEDULED → CONFIRMED → COMPLETED / CANCELED / NO_SHOW.
- ✅ Cancelamento self-service do cliente (configurável + janela mínima).
- ✅ Email transacional (confirmação, cancelamento, lembrete).
- ✅ Configuração de regras: antecedência mínima, intervalo de slots, janela de
  agendamento e cancelamento.
- ✅ Branding por tenant (cores primária/secundária/accent, logo, favicon).
- ✅ PWA: install prompt, manifest dinâmico, push notifications.
- ✅ "Meus agendamentos" pro cliente — listar, cancelar, ver detalhe.
- ✅ Wizard de criação manual no admin (staff cria pra cliente walk-in).
- ✅ Bloqueios tenant-wide (feriados, eventos especiais).
- ✅ Templates de mensagem editáveis por tenant.
- ✅ LGPD: consentimento explícito, política de privacidade, termos de uso,
  exportação de dados, exclusão de conta.

## 7. Roadmap visível (Fase 2+)

Em ordem aproximada de prioridade:

1. **Pagamento online + sinal antecipado (PIX)** — reduz no-show, gera
   transactional fee. Único feature que paga a si mesmo.
2. **WhatsApp dispatch real** (via Z-API/Evolution API) — confirmação +
   lembretes 24h e 2h antes. Hoje só email.
3. **Lembretes automáticos** — estrutura existe, falta dispatch.
4. **Programa de fidelidade simples** — N reservas → desconto.
5. **Marketing campaigns** — envio em massa segmentado.
6. **Branding white-label completo** — domínio próprio do negócio (não
   `*.aralabs.com.br`).
7. **Múltiplas unidades** (rede com tenant-pai) — segmento médio.

**Conscientemente fora do roadmap:**

- App nativo iOS/Android (PWA cobre 90%, custo de manter 2-3 stacks não compensa).
- Multi-idioma / multi-moeda (escopo Brasil).
- WhatsApp Business API oficial (caro pro volume; Z-API serve).

## 8. Stack técnico

**Frontend:**
- Next.js 16 (App Router, Server Components, Server Actions, proxy.ts)
- React 19
- Tailwind CSS 4
- TypeScript estrito
- PWA via Next.js manifest dinâmico

**Backend:**
- Supabase (Postgres + Auth + Storage + Realtime + pg_cron)
- RLS como isolamento primário
- Edge functions pra dispatch de notificações
- Server Actions como default (Route Handlers só pra webhooks/manifest)

**Infra:**
- Vercel (hosting + Fluid Compute)
- Supabase Cloud (`*.aralabs.com.br` resolve via proxy de subdomínio)
- Sentry (error monitoring, free tier)
- Vercel Analytics (Core Web Vitals)

**Segurança:**
- 3 clientes Supabase com escopos distintos (browser, server SSR, secret server-only).
- Toda mutation passa por validação Zod antes de tocar o banco.
- RLS policies cobrem: platform admin, staff, customer read, customer write.
- Roles: `BUSINESS_OWNER`, `RECEPTIONIST`, `PROFESSIONAL`, `CUSTOMER`,
  `PLATFORM_ADMIN`.

## 9. Arquitetura em uma frase

Multi-tenant via subdomínio resolvido pelo proxy → tenant context no header
`x-ara-tenant-id` → toda query no banco filtrada por `tenant_id` + RLS valida
cross-cutting → frontend renderiza com branding do tenant.

## 10. Domínios

- **Cliente final:** `<slug>.aralabs.com.br` (home pública + `/book` agendamento +
  `/meus-agendamentos` + `/perfil`).
- **Staff:** `<slug>.aralabs.com.br/admin/*` (autenticado).
- **Plataforma (storefront, vendas, login geral):** `aralabs.com.br` →
  `aralabs-storefront` (repo separado).

## 11. Provas sociais

> _Placeholder — preencher quando tivermos casos reais publicáveis com
> consentimento. Por enquanto piloto interno e fixtures de exemplo._

- Tenants de fixture em dev: `barbearia-teste`, `casa-do-corte`, `barba-preta`,
  `bela-imagem`.
- Primeiro piloto real: TBD.

## 12. Links úteis

- Landing pública de exemplo: `http://salao-bela-imagem.lvh.me:3008/` (dev)
- Repositório: privado (GitHub `AraLabs-Arapongas/ara-agenda`)
- Spec base: `docs/superpowers/specs/2026-04-18-ara-barber-fase1-design.md`
- Roadmap detalhado: `docs/futuro.md`
- Smoke test: `docs/smoke-test-pilot.md`

## 13. CTAs sugeridos pro site mãe (aralabs.com.br)

- **Hero:** "Sua agenda online, sem caderno e sem WhatsApp manual"
- **Subhead:** "Pra barbearia, salão, estética e qualquer negócio que vende tempo
  por horário."
- **CTA primário:** "Comece grátis 14 dias"
- **CTA secundário:** "Ver demo"
- **Prova social:** "Já usado por X profissionais" (preencher quando tivermos dado).
- **Seção features:** puxar 4-5 dos diferenciais (item 5) com ícones.

## 14. Tom de voz

- **Direto.** Sem buzzword. "Reserva", não "experiência de agendamento".
- **Confiante mas humilde.** Não promete o que não entrega.
- **Foco em dor real.** "Cliente não confirmou pelo WhatsApp" > "Otimize sua
  jornada".
- **Português coloquial brasileiro.** "A gente" em algumas pontas é OK; "vocês"
  no plural não.
- **Sem inglês desnecessário.** "Reserva" > "booking", "Profissional" >
  "professional", "Janela de cancelamento" > "cancellation window".

## 15. Não-objetivos (anti-features)

Coisas que **explicitamente não fazemos** pra manter foco:

- Não somos rede social do salão (tipo Booksy com feed de fotos).
- Não somos marketplace que cobra comissão por reserva (somos SaaS, não
  middleman).
- Não substituímos sistema fiscal/contábil — integramos com quem o negócio já
  usa (futuro).
- Não fazemos hardware (terminal de pagamento, totem).
