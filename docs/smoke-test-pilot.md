# Smoke test — piloto (Spec 1)

> **Manutenção:** sempre que um fluxo mudar (novas telas, rotas, ações, guards, rules de negócio, seed), atualizar este doc no **mesmo PR**. Foca em *comportamento*, não em copy/cor/layout.

Roteiro manual pra validar o fluxo ponta-a-ponta do piloto antes de soltar pra um negócio real.
Use `barbearia-teste` e `bela-imagem` como tenants de referência.

URLs locais:

- `http://barbearia-teste.lvh.me:3008`
- `http://bela-imagem.lvh.me:3008`

> Pré-condição: `pnpm dev` rodando na porta 3008 + projeto Supabase `ara-barber-dev` com seed aplicado.
>
> **Pré-condição (após revamp 2026-04-26):** colunas `tenants.{min_advance_hours, slot_interval_minutes, customer_can_cancel}` existem; `availability_blocks.professional_id` é nullable (NULL = bloqueio tenant-wide); tabela `tenant_message_templates` seedada com 6 templates default por tenant existente (3 EMAIL + 3 WHATSAPP).

## Credenciais de teste

**Staff (login em `/admin/login`):**

| Tenant | Email | Senha | Role |
| --- | --- | --- | --- |
| barbearia-teste | `dono@barbearia-teste.test` | `barber1234` | SALON_OWNER |
| bela-imagem | `dono@bela-imagem.test` | `bela1234` | SALON_OWNER |

**Cliente final:** e-mail real (OTP chega por email), ex: `thiagodevtavares@gmail.com`.

---

## 0c. Foundation utils (revamp 2026-04-26)

- [ ] `getBookingContext({from, to})` retorna `{services, professionals, professionalServices, businessHours, availability, blocks, existingAppointments}` num único payload (testar via wizard manual em fase posterior).
- [ ] Slot calculator respeita `availability_blocks.professional_id IS NULL` (block tenant-wide some pra todo profissional).

---

## 1. Home pública do tenant

**Visitante deslogado:**
- [ ] Abrir `/` em anônimo carrega sem erro.
- [ ] Logo do tenant aparece em tamanho compacto (não ocupa a tela inteira).
- [ ] Headline aparece (texto do tenant se setado, fallback genérico caso contrário).
- [ ] CTA "Agendar agora" leva pra `/book`.
- [ ] Bloco "Serviços" mostra até 4 serviços ativos com nome, duração e preço. Clicar leva pra `/book`.
- [ ] Bloco "Horário de funcionamento" mostra os 7 dias da semana com `HH:MM – HH:MM` ou "Fechado".
- [ ] "Já sou cliente? Entrar" abre bottom sheet com login OTP.
- [ ] **Tab bar do cliente NÃO aparece** (só após login).

**Visitante logado (sem reserva futura):**
- [ ] Mesmos blocos da versão deslogada.
- [ ] CustomerAccess mostra "Bem-vindo, [nome]" + botão "Minhas reservas".
- [ ] **Tab bar do cliente aparece**: Início / Agendar / Reservas / Perfil.

**Visitante logado (com reserva futura):**
- [ ] Bloco "Sua próxima reserva" aparece logo após o hero, com horário + serviço + profissional + badge de status.
- [ ] Clicar na próxima reserva abre `/meus-agendamentos/[id]` direto.
- [ ] CTA principal muda pra "Agendar novamente".

## 2. Wizard de booking (cliente novo)

- [ ] `/book` lista só serviços com `is_active = true`.
- [ ] Selecionar serviço → `/book/profissional` mostra quem atende aquele serviço + "Qualquer profissional".
- [ ] Selecionar profissional → `/book/data` desativa dias sem business_hours/availability.
- [ ] Selecionar dia → `/book/horario` desativa slots passados, em conflito e dentro de bloqueio.
- [ ] Selecionar slot livre → `/book/login` pede OTP (anônimo).
- [ ] Após OTP → `/book/confirmar` pede nome/telefone.
- [ ] Confirmar → cria `appointments` com snapshot + marca `customers.consent_given_at` → redireciona pra `/book/sucesso`.

## 3. Customer já logado

- [ ] `/meus-agendamentos` lista a reserva criada com status `SCHEDULED`.
- [ ] Clicar no card (em qualquer área que não seja o botão Cancelar) abre `/meus-agendamentos/[id]` com os dados do agendamento. Navegação NÃO dispara fetch no appointment (Network tab: só RSC payload do boundary, zero request ao Supabase).
- [ ] Acessar `/meus-agendamentos/[id]` via URL direta (ou email de confirmação) carrega — cache vazio aciona server action de fallback.
- [ ] "Voltar" (link topo do detalhe ou botão do OS) volta pra lista sem reload.
- [ ] Cancelar pelo card na lista dentro da janela → status vira `CANCELED`.
- [ ] Cancelar pelo botão na tela de detalhe dentro da janela → redireciona pra lista, status `CANCELED`.
- [ ] Cancelar fora da janela (ajustar `cancellation_window_hours` pra forçar) → erro com copy clara da janela de horas.

## 4. Conflito de horário

- [ ] Com reserva existente às 15:00 pro profissional X, `/book/horario` desabilita 15:00 pra X.
- [ ] Tentativa forçada via request direto → `createAppointment` retorna "Horário não disponível".

## 5. Staff — agenda

- [ ] Login em `/admin/login` com staff seeded redireciona pro dashboard.
- [ ] Tab bar do staff navega: Início / Agenda / Equipe / Serviços / Mais.
- [ ] `/admin/dashboard` (home staff) mostra bloco "Precisam confirmar" com count quando há SCHEDULED futuros. Botão inline "Confirmar" transiciona pra CONFIRMED sem abrir detalhe, row some da lista após o refresh.
- [ ] Quando não há SCHEDULED pendentes, o bloco "Precisam confirmar" some da home.
- [ ] MARCADO (SCHEDULED) aparece com badge em tom warning/amber — visualmente distinto de CANCELADO (badge cinza, card opaco + line-through).
- [ ] `/admin/dashboard/agenda` lista appointments do dia.
- [ ] `?date=YYYY-MM-DD` navega entre dias.
- [ ] Detalhe do appointment expõe só transições permitidas por `canTransition`.
- [ ] Transição persiste status e atualiza a UI sem reload.
- [ ] Realtime: criar appointment em outra aba → agenda atualiza sozinha em ≤2s.

### 5a. Home revamp (revamp 2026-04-26)

- [ ] 4 stat cards aparecem em grid 2x2: **Agenda hoje**, **Previsto**, **Pendentes**, **Concluídos**. Hint do "Pendentes" mostra "N atrasados" se algum existe; senão "no horário".
- [ ] Bloco "Próximo atendimento" (full-width destacado) aparece quando há agendamento futuro hoje.
- [ ] Quick actions exibe 4 botões em grid 2x2 (mobile) / 4 colunas (sm+): **Novo agendamento**, **Abrir agenda**, **Copiar link**, **Bloquear horário**.
  - Novo agendamento → `/admin/dashboard/agenda/novo` (wizard).
  - Abrir agenda → `/admin/dashboard/agenda`.
  - Copiar link copia `https://<subdomain>.aralabs.com.br` pro clipboard; texto vira "Copiado!" por 2s.
  - Bloquear horário → `/admin/dashboard/bloqueios?new=1` (rota será criada em fase posterior — 404 esperado por enquanto).
- [ ] Bloco "Precisam confirmar" continua aparecendo com botão inline e contagem (não foi removido).
- [ ] Seção "Atenção" sempre aparece logo após PendingConfirmations:
  - Vazia: card "Tudo certo por enquanto. Nenhuma pendência importante hoje.".
  - Com itens: lista cards com ícone warning. Atrasado linka pro detalhe do agendamento; Sem horário linka pro detalhe do profissional.
- [ ] Bloco "Próximos" (lista até 5) continua aparecendo abaixo da Atenção.

### 5b. Agenda revamp (revamp 2026-04-26)

- [ ] Filtros (2 selects) aparecem entre o DaySwitcher e a lista: **Todos os profissionais** + **Todos os status**.
- [ ] Selecionar profissional → URL ganha `?professional=<id>`; lista re-renderiza filtrada.
- [ ] Selecionar status → URL ganha `?status=<STATUS>`; combinável com profissional.
- [ ] Resumo do dia aparece logo abaixo dos filtros quando há ≥1 ativo: `N agendamentos · R$ X,XX previsto[ · N atrasos]`.
- [ ] Lista vazia + sem filtros aplicados: empty state actionável com **Adicionar agendamento** (linka pro wizard) + **Copiar link de agendamento** (toast "Copiado!" 2s).
- [ ] Lista vazia mas com filtros aplicados: card "Nenhum agendamento para os filtros selecionados." (não mostra empty state principal).
- [ ] StaffPushBanner, DaySwitcher e RealtimeRefresh continuam funcionando.

## 5b. Wizard de criação manual de agendamento (revamp 2026-04-26)

Acessar `/admin/dashboard/agenda/novo` autenticado como staff.

- [ ] Step 1 — escolher cliente existente da lista; busca por nome funciona; selecionar avança state.
- [ ] Step 1 — alternar pra "Novo cliente"; preencher nome obrigatório; telefone/e-mail opcionais; "Continuar" só habilita com nome preenchido.
- [ ] Step 2 — lista só serviços com `is_active=true`; selecionar muda card pra estado selecionado.
- [ ] Step 3 — lista só profissionais vinculados ao serviço (via `professional_services`); empty state quando vínculo não existe.
- [ ] Step 4 — date picker default = hoje no TZ do tenant; slots calculados client-side; slots em conflito ficam riscados/desabilitados.
- [ ] Step 4 — bloquear horário tenant-wide (`availability_blocks` com `professional_id NULL`) faz aquele horário sumir.
- [ ] Step 5 — resumo bate com escolhas; observações opcionais (max 500 chars).
- [ ] Submit → cria appointment com `status=CONFIRMED`, redireciona pra `/admin/dashboard/agenda/[id]`.
- [ ] Cliente novo apareceu em `/admin/dashboard/clientes`.
- [ ] Tentar criar segundo agendamento mesmo profissional + mesmo horário → erro "Horário não disponível".

## Recuperação de senha (staff)

Validar fluxo self-service de "Esqueci a senha" em `/admin/*`.

### Passos

1. Em `https://<slug>.aralabs.com.br/admin/login`, click "Esqueci a senha"
2. Preencher email do staff cadastrado → submit
3. UI mostra "Se essa conta existe, enviamos um link..."
4. Verificar email recebido:
   - [ ] Sender: `no-reply@aralabs.com.br`
   - [ ] Subject: `Redefinir senha — <Nome do tenant>`
   - [ ] Body menciona o nome do tenant
5. Click no botão "Redefinir senha"
6. Página `/admin/reset-password` carrega com form
7. Tentar validações (< 8 chars, senhas diferentes) → erros inline
8. Definir senha válida → redirect `/admin/dashboard` logado
9. Logout → relogar com nova senha em `/admin/login` → ✓
10. Voltar pro link do email → click 2ª vez → "Link expirado ou já usado"

### Edge cases manuais

- Email não cadastrado: deve retornar mesma msg de sucesso (anti-enumeration)
- Acesso direto a `/admin/forgot-password` ou `/admin/reset-password` sem subdomain de tenant: redirect pra `/`

## 6. Staff — serviços

- [ ] `/admin/dashboard/servicos` cria serviço novo → aparece no wizard.
- [ ] Editar serviço → mudanças persistem e aparecem no wizard.
- [ ] Desativar serviço → some do wizard público.

### 6a. Serviços revamp (revamp 2026-04-26)

- [ ] Busca por nome (input com ícone de lupa) aparece quando há ≥1 serviço; filtra a lista client-side; "Nada encontrado para X" quando não bate.
- [ ] Cada card de serviço mostra: nome, "X min · R$ Y,YY", linha "Profissionais: A, B, C" quando há vínculo, linha "Nenhum profissional vinculado" em **warning** quando não há.
- [ ] Badge de visibilidade rotulada: **Visível para clientes** (verde) ou **Oculto** (cinza) — substitui o antigo "Ativo/Inativo".
- [ ] Botão Power (toggle visibilidade) tem aria-label "Ocultar do público" / "Tornar visível".
- [ ] Empty state quando lista vazia: card centralizado com botão "Adicionar serviço".

## 7. Staff — equipe (detail consolidado)

Toda gestão do profissional vive em `/admin/dashboard/profissionais/[id]`.

- [ ] Criar profissional em `/admin/dashboard/profissionais` → aparece na lista.
- [ ] Toggle Ativo/Inativo → inativo some do wizard.
- [ ] Abrir detalhe expõe 4 seções, cada uma persistindo:
  - **Info:** editar nome/apelido/telefone.
  - **Serviços:** toggle chip vincula/desvincula → wizard reflete.
  - **Jornada:** editor semanal; remover segunda → `/book/data` desativa segundas.
  - **Bloqueios:** criar bloqueio (ex.: amanhã 14-17h) → slots no intervalo ficam disabled no wizard. Deletar também funciona.
- [ ] `/admin/dashboard/disponibilidade` e `/equipe-servicos` redirecionam pra `/profissionais`.
- [ ] `/admin/dashboard/configuracoes/horarios`: fechar um dia → wizard bloqueia aquele weekday.

### 7a. Equipe revamp (revamp 2026-04-26)

- [ ] Header da listagem mostra resumo "N trabalhando hoje[ · M sem horário configurado]" abaixo da copy padrão.
- [ ] Cada card de profissional mostra:
  - Avatar com iniciais + nome.
  - Badge **Ativo**/**Inativo** + chevron à direita.
  - Linha de jornada: `Trabalha hoje HH:MM–HH:MM` quando há availability hoje, `Sem horário configurado` (em **warning**) quando não há nenhuma availability cadastrada, ou `De folga hoje` quando tem availability mas não pro weekday corrente.
  - Linha "N agendamentos hoje · R$ X,XX previsto" baseada nos agendamentos ativos do dia (exclui CANCELED/NO_SHOW).
  - Linha "N serviços vinculados · Acesso ao painel"/"Sem acesso ao painel" (acesso = `user_id IS NOT NULL`).
- [ ] Card inteiro continua sendo um link pro detalhe `/admin/dashboard/profissionais/[id]`.

## 7b. Staff — cadastros auxiliares

- [ ] `/admin/dashboard/clientes` lista o cliente criado no passo 2 (read-only).

## 7c. Notificações — confirmação (email + push cliente)

- [ ] Agendar pelo wizard: email "Reserva confirmada" chega no inbox do cliente.
- [ ] Prompt de push aparece após confirmar; aceitar registra subscription.
- [ ] Próximo agendamento com push ativo: push "Horário marcado" chega em <5s.
- [ ] Clicar notificação abre `/meus-agendamentos/[id]`.

## 7d. Notificações — cancelamento

- [ ] Cliente cancela: email com "recebemos seu cancelamento" + push cliente + push staff.
- [ ] Staff cancela: email com "a empresa cancelou" + pushes equivalentes.
- [ ] `canceled_by` preenchido em `appointments` (uuid do user que cancelou).

## 7e. Notificações — staff push

- [ ] Primeiro acesso em `/admin/dashboard/agenda`: banner "Ativar avisos" aparece.
- [ ] Ativar registra subscription com tenant_id. Em X: dismiss permanente.
- [ ] Recuperação via `/admin/dashboard/mais` → Avisos (toggle).
- [ ] Novo agendamento via cliente → push no staff em <5s.

## 7f. Notificações — lembretes

- [ ] Appointment com `start_at = now()+24h` recebe push em ≤5min (cron).
- [ ] Flag `reminder_24h_sent_at` preenchida; cron 2× não duplica push.
- [ ] Mesmo fluxo pro 2h.

## 7g. PWA install

- [ ] Cliente logado sem PWA instalada: bottom sheet aparece.
- [ ] Chrome/Edge: botão "Instalar" usa dialog nativo.
- [ ] iOS Safari: instruções manuais.
- [ ] "Mais tarde" salva `pwa_install_dismissed_at` + localStorage por 30d.
- [ ] Após instalar: `pwa_installed_at` preenche, badge "📱 Instalado" em `/admin/dashboard/clientes`.

## 7h. Notificações — auditoria

- [ ] `notification_log` tem rows `status=sent` pros eventos disparados.
- [ ] Falhas aparecem com `error_message` preenchido.

## 8. LGPD

- [ ] `/perfil` → "Baixar meus dados" baixa JSON com customer + appointments + snapshot do tenant.
- [ ] Apagar conta (digitar "APAGAR"):
  - Cancela reservas futuras.
  - Zera `customer.name/phone/email/user_id/notes` e preenche `deleted_at`.
  - `customer_name_snapshot` dos appointments antigos vira "Cliente removido".
  - Sessão expira.
- [ ] Novo login com mesmo email cria **novo** customer row; o apagado permanece isolado.

## 8b. Mais — reorg + Meu negócio (revamp 2026-04-26)

Acessar `/admin/dashboard/mais` autenticado como staff.

- [ ] Página exibe 5 seções (Meu negócio, Agenda, Gestão, Comunicação, Conta) + cartão "Sair".
- [ ] Cada item linka pra rota correta; itens não-implementados nesta fase abrem placeholder "Em construção" (Regras, Bloqueios, E-mails, WhatsApp, Notificações, Usuários, Plano, Segurança).

Perfil público (`/admin/dashboard/perfil`):

- [ ] Form pré-preenchido com dados atuais do tenant.
- [ ] Editar nome, contato, WhatsApp, e-mail, endereço, cidade, UF e CEP.
- [ ] "Salvar" mostra "Salvo!"; recarregar a página confirma persistência.
- [ ] Apagar e-mail (campo vazio) salva sem erro e mantém vazio depois do reload (string vazia → NULL no banco).

Link de agendamento (`/admin/dashboard/link`):

- [ ] URL exibida usa o host correto (lvh.me em dev, aralabs.com.br em prod).
- [ ] "Copiar link" copia pra clipboard e botão vira "Copiado!" por 2s.
- [ ] "Abrir página pública" abre a home do tenant em nova aba.
- [ ] QR code SVG renderizado embaixo.
- [ ] "Baixar QR Code" baixa arquivo `qr-<slug>.svg`.
- [ ] "Compartilhar no WhatsApp" abre `wa.me/?text=...` com mensagem default contendo o link.

Marca e aparência (`/admin/dashboard/marca`):

- [ ] Form pré-preenchido com cores/headlines atuais.
- [ ] Trocar cor primária (color picker ou hex no input) → "Salvar" → recarregar home pública (`http://<slug>.lvh.me:3008/`) e confirmar `--brand-primary` mudou.
- [ ] Apagar URL do logo (campo vazio) salva sem erro; cores vazias também (NULL → reset pro tema default).
- [ ] Hex inválido (`#zzz`) bloqueia salvar com mensagem de erro inline.

## 9. Mais — Agenda + Gestão (revamp 2026-04-26)

### 9a. Regras de agendamento
- [ ] /admin/dashboard/regras: 4 fields editáveis (antecedência mínima em horas, intervalo entre horários, janela de cancelamento em horas, toggle de cancelamento pelo cliente).
- [ ] Salvar persiste; refresh confirma. (NOTA: aplicação no slot calc é follow-up — só persistência nesta fase.)
- [ ] User não-BUSINESS_OWNER (RECEPTIONIST/PROFESSIONAL) recebe mensagem PT-BR ao tentar salvar.

### 9b. Bloqueios
- [ ] /admin/dashboard/bloqueios lista bloqueios futuros cross-professional (negócio inteiro + por profissional).
- [ ] Criar bloqueio "Negócio inteiro" → desabilita slot pra todos os profs no /book.
- [ ] Criar bloqueio "Um profissional" → desabilita só pra ele.
- [ ] Excluir bloqueio funciona; horário volta a aparecer.
- [ ] /admin/dashboard/disponibilidade redireciona pra /bloqueios.
- [ ] Detalhe do profissional NÃO tem mais form de bloqueios local — só link "Ver bloqueios deste profissional" que leva pra /bloqueios?professional=<id>.

### 9c. Clientes
- [ ] /admin/dashboard/clientes: busca client-side por nome, telefone ou e-mail filtra a lista.
- [ ] Cada card mostra contagem de agendamentos, última visita e total concluído (R$).
- [ ] Click no card vai pra /admin/dashboard/clientes/[id] com histórico completo + dados de contato.
- [ ] No detalhe, "Novo agendamento" leva pro wizard com `?customerId=<uuid>` pré-preenchendo o cliente.

### 9d. Financeiro
- [ ] /admin/dashboard/financeiro mostra disclaimer "não representa pagamento real".
- [ ] Filtro Hoje/Semana/Mês muda os dados via `?preset=`.
- [ ] 4 cards: Previsto / Realizado / Perdido / Ticket médio (em R$).
- [ ] Top serviços e top profissionais ordenados por valor concluído.
- [ ] Movimentos recentes lista até 20 com link pro detalhe do agendamento.

### 9e. Relatórios
- [ ] /admin/dashboard/relatorios mostra contagem por status (5 cards) no período (default Mês).
- [ ] Top serviços e top profissionais — ordenado por contagem (não R$).
- [ ] Filtro Hoje/Semana/Mês altera os dados.

## 10. Fora de escopo — stubs

- [ ] Rotas `/admin/dashboard/operacao` retorna placeholder sem quebrar.
- [ ] Itens "Em construção" da Mais (Comunicação, Conta) levam a placeholder com botão "Voltar".

## 11. Smoke técnico

- [ ] `pnpm typecheck` limpo.
- [ ] `pnpm test` verde.
- [ ] `pnpm lint` zero errors (warnings de `console` em `customer-client.ts` são pré-existentes).
- [ ] `pnpm build` completa sem erro.

## Reset entre runs

```sql
-- via MCP supabase no projeto ara-barber-dev:
delete from appointments where tenant_id in (
  select id from tenants where slug in ('barbearia-teste','bela-imagem')
);
update customers set deleted_at = now(), user_id = null, email = null, phone = null, name = null
  where tenant_id in (select id from tenants where slug in ('barbearia-teste','bela-imagem'));
```

Reset profundo: rodar seed de profissionais/serviços via `supabase/seed` (TODO — Épico 10).

## Known bugs do piloto

Listar aqui assim que descobrir — tudo que não for P0 vira task do Épico 10.
