export type ChecklistItem = {
  id: string
  title: string
  detail?: string
}

export type ChecklistSection = {
  id: string
  title: string
  subtitle: string
  tone: 'blocker' | 'decision' | 'limitation' | 'nice' | 'plan'
  items: ChecklistItem[]
}

export const LAUNCH_CHECKLIST: ChecklistSection[] = [
  {
    id: 'technical-blockers',
    title: '🔴 Blockers técnicos',
    subtitle: 'Precisa rodar antes de abrir pro primeiro cliente.',
    tone: 'blocker',
    items: [
      {
        id: 'supabase-prod',
        title: 'Projeto Supabase prod separado do dev',
        detail:
          'Hoje é ara-barber-dev. Migrar schema + RLS + functions + secrets pro projeto prod.',
      },
      {
        id: 'deploy-vercel',
        title: 'Deploy (Vercel ou similar) com env vars',
        detail:
          'NEXT_PUBLIC_SUPABASE_URL/PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, TENANT_ROOT_DOMAIN=aralabs.com.br, Resend keys, CRON_SECRET.',
      },
      {
        id: 'dns-wildcard',
        title: 'DNS wildcard *.aralabs.com.br → Vercel, HTTPS automático',
      },
      {
        id: 'rotate-secrets',
        title: 'Rotação de credenciais expostas',
        detail:
          'Epic 10 Task 2. Se secrets passaram em chat/doc durante dev, rotacionar DB password + secret key antes de prod.',
      },
      {
        id: 'create-tenant-script',
        title: 'Script `pnpm create-tenant` (ou SQL manual via Admin API)',
        detail:
          'Epic 10 Task 11. Não temos UI admin (migrou pro aralabs-storefront), então precisa script pra criar tenant + staff user.',
      },
      {
        id: 'tenant-seeded',
        title: 'Tenant piloto cadastrado com dados reais',
        detail:
          'Branding (logo, cores), serviços, profissionais, professional_services, business_hours, professional_availability.',
      },
      {
        id: 'staff-user',
        title: 'Staff user criado via Admin API (não insert direto)',
        detail:
          'Memory project_supabase_direct_user_insert_pitfall: insert em auth.users direto explode login. Usar supabase.auth.admin.createUser().',
      },
      {
        id: 'resend-domain',
        title: 'Domínio verificado no Resend',
        detail: 'DNS (SPF/DKIM) pode levar 24h. RESEND_FROM_EMAIL com domínio verificado.',
      },
      {
        id: 'smoke-prod',
        title: 'Smoke test passado em prod real (HTTPS, não lvh.me)',
        detail: 'Usar docs/smoke-test-pilot.md como roteiro.',
      },
      {
        id: 'pgtap-rls',
        title: 'pgTAP de RLS (Epic 10 Task 1 + 15)',
        detail:
          'Valida isolamento entre tenants. Com só 1 piloto o risco é baixo; obrigatório antes do 2º tenant.',
      },
    ],
  },
  {
    id: 'founder-decisions',
    title: '🟡 Decisões de produto/comercial',
    subtitle: 'Bloqueiam prática — não são código.',
    tone: 'decision',
    items: [
      {
        id: 'pilot-tenant',
        title: 'Qual é o primeiro tenant?',
        detail: 'Nome, serviços, horários, logo. É a primeira coisa a destravar.',
      },
      {
        id: 'commercial-model',
        title: 'Modelo comercial do piloto',
        detail: 'Grátis? Desconto? Tempo determinado? Contrato formal ou informal?',
      },
      {
        id: 'terms-of-service',
        title: 'Termos de uso',
        detail:
          'Política de privacidade já existe. ToS não. Pra piloto informal pode empurrar, mas arrisca.',
      },
      {
        id: 'support-channel',
        title: 'Canal de suporte pro tenant',
        detail: 'WhatsApp seu direto? Email? SLA de resposta?',
      },
      {
        id: 'onboarding-approach',
        title: 'Onboarding: você configura ou o dono?',
        detail: 'Primeiro cliente provavelmente você senta junto e preenche tudo.',
      },
    ],
  },
  {
    id: 'known-limitations',
    title: '📋 Limitações conhecidas (alinhar com o cliente)',
    subtitle: 'O app NÃO faz essas coisas. Dono precisa saber antes de assinar.',
    tone: 'limitation',
    items: [
      {
        id: 'no-push',
        title: 'Push notifications em standby',
        detail: 'Só email de confirmação/cancelamento. Push só pós-launch.',
      },
      {
        id: 'no-reschedule',
        title: 'Sem reagendamento',
        detail: 'Cliente cancela + cria nova reserva. Virá junto com billing.',
      },
      {
        id: 'no-online-payment',
        title: 'Sem pagamento online',
        detail: 'Cobrança no local. Página de financeiro é stub.',
      },
      {
        id: 'no-tablet-mode',
        title: 'Sem modo operação (PIN tablet)',
        detail: 'Staff opera sempre logado na sua conta.',
      },
      {
        id: 'no-reviews-gallery-promo',
        title: 'Sem reviews, galeria ou promoções',
        detail: 'Ficam pra Fase 2+.',
      },
      {
        id: 'single-unit',
        title: '1 tenant = 1 estabelecimento',
        detail: 'Sem suporte a multi-unidade.',
      },
    ],
  },
  {
    id: 'nice-to-haves',
    title: '🟢 Nice-to-have (pode empurrar pós-launch)',
    subtitle: 'Se sobrar tempo antes, ótimo. Senão, dá pra entregar.',
    tone: 'nice',
    items: [
      {
        id: 'google-oauth',
        title: 'Google OAuth pro cliente (Epic 10 Task 16)',
        detail: 'Hoje só OTP email. Google reduz fricção no login.',
      },
      {
        id: 'edit-crud',
        title: 'Edição/soft-delete completo dos cadastros (Task 17)',
        detail: 'Hoje cria mas edit é parcial.',
      },
      {
        id: 'e2e-ci',
        title: 'E2E Playwright no CI (Task 7)',
        detail: 'Ajuda a não regredir em fluxos críticos.',
      },
      {
        id: 'http-404',
        title: 'Status HTTP 404 correto em tenant-not-found (Task 13)',
        detail: 'Hoje renderiza com 200. Afeta SEO.',
      },
      {
        id: 'city-on-home',
        title: 'Exibir cidade na home (Task 24)',
        detail: 'tenants.city já existe, UI não.',
      },
    ],
  },
  {
    id: 'launch-order',
    title: '🎯 Ordem sugerida pra destravar o launch',
    subtitle: 'Sequência pragmática — cada passo destrava o próximo.',
    tone: 'plan',
    items: [
      { id: 'step-1', title: '1. Escolher e coletar dados do tenant piloto' },
      { id: 'step-2', title: '2. Provisionar Supabase prod + migrar schema' },
      { id: 'step-3', title: '3. Rotacionar credenciais expostas' },
      { id: 'step-4', title: '4. Script pnpm create-tenant (ou SQL manual)' },
      { id: 'step-5', title: '5. Deploy Vercel + DNS + env vars' },
      { id: 'step-6', title: '6. Resend domínio verificado' },
      {
        id: 'step-7',
        title: '7. Criar tenant + staff + cadastros (branding, serviços, horários, pros)',
      },
      { id: 'step-8', title: '8. Smoke test em prod com URL HTTPS real' },
      { id: 'step-9', title: '9. pgTAP RLS (opcional antes do 1º, obrigatório antes do 2º)' },
      { id: 'step-10', title: '10. Handoff pro cliente' },
    ],
  },
]
