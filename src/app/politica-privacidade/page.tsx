import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { ThemeInjector } from '@/components/branding/theme-injector'
import { TenantLogo } from '@/components/branding/tenant-logo'
import { CustomerShell } from '@/components/customer/customer-shell'

export default async function PrivacyPolicyPage() {
  const tenant = await getCurrentTenantOrNotFound()

  return (
    <>
      <ThemeInjector
        branding={{
          primaryColor: tenant.primaryColor,
          secondaryColor: tenant.secondaryColor,
          accentColor: tenant.accentColor,
        }}
      />
      <div className="min-h-screen bg-bg text-fg">
        <CustomerShell>
          <header className="border-b border-border bg-surface/80 backdrop-blur">
            <div className="mx-auto flex max-w-xl items-center gap-3 px-5 py-3 sm:px-6">
              <Link href="/" aria-label="Home" className="flex min-w-0 items-center gap-3">
                <TenantLogo logoUrl={tenant.logoUrl} name={tenant.name} size={40} />
                <div className="min-w-0">
                  <p className="truncate font-display text-[1rem] font-semibold leading-tight tracking-tight text-fg">
                    {tenant.name}
                  </p>
                  <p className="text-[0.6875rem] uppercase tracking-[0.14em] text-fg-subtle">
                    Privacidade
                  </p>
                </div>
              </Link>
            </div>
          </header>

          <main className="mx-auto w-full max-w-xl px-5 pt-6 pb-16 sm:px-6">
            <Link
              href="/perfil"
              className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] text-fg-muted hover:text-fg"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Perfil
            </Link>

            <article className="prose-ara space-y-4 text-[0.9375rem] leading-relaxed text-fg">
              <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
                Política de privacidade
              </h1>
              <p className="text-fg-muted">
                Esta é a política de privacidade do <strong>{tenant.name}</strong>, operado pela
                plataforma AraLabs. Resumo em linguagem direta.
              </p>

              <section>
                <h2 className="mt-6 font-display text-[1.125rem] font-semibold text-fg">
                  O que guardamos
                </h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-fg-muted">
                  <li>Seu e-mail, usado para login e avisos da reserva.</li>
                  <li>Seu nome e telefone, se você preencher ao confirmar reserva.</li>
                  <li>Histórico de reservas neste estabelecimento.</li>
                </ul>
              </section>

              <section>
                <h2 className="mt-6 font-display text-[1.125rem] font-semibold text-fg">
                  Pra que usamos
                </h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-fg-muted">
                  <li>Confirmar e lembrar de horários agendados.</li>
                  <li>
                    Avisar quando o estabelecimento precisar mudar algo (profissional indisponível,
                    reagendamento).
                  </li>
                  <li>Mostrar ao estabelecimento quem chegou e o histórico de atendimentos.</li>
                </ul>
              </section>

              <section>
                <h2 className="mt-6 font-display text-[1.125rem] font-semibold text-fg">
                  Com quem compartilhamos
                </h2>
                <p className="mt-2 text-fg-muted">
                  Seus dados ficam visíveis apenas para a equipe deste estabelecimento e para a
                  AraLabs (operadora da plataforma). Não vendemos nem compartilhamos com terceiros
                  para marketing.
                </p>
              </section>

              <section>
                <h2 className="mt-6 font-display text-[1.125rem] font-semibold text-fg">
                  Seus direitos
                </h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-fg-muted">
                  <li>
                    <strong className="text-fg">Acessar:</strong> na tela de perfil você baixa uma
                    cópia completa dos seus dados neste estabelecimento em JSON.
                  </li>
                  <li>
                    <strong className="text-fg">Corrigir:</strong> você pode atualizar nome e
                    telefone a qualquer momento.
                  </li>
                  <li>
                    <strong className="text-fg">Apagar:</strong> na tela de perfil você apaga seu
                    cadastro deste estabelecimento — as reservas futuras são canceladas e o
                    histórico fica anonimizado.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="mt-6 font-display text-[1.125rem] font-semibold text-fg">
                  Base legal (LGPD)
                </h2>
                <p className="mt-2 text-fg-muted">
                  Tratamos seus dados pessoais com fundamento nas seguintes bases legais da Lei
                  Geral de Proteção de Dados (Lei 13.709/2018):
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-fg-muted">
                  <li>
                    <strong className="text-fg">Execução de contrato:</strong> realizar e gerenciar
                    sua reserva (art. 7º, V).
                  </li>
                  <li>
                    <strong className="text-fg">Consentimento:</strong> envio de lembretes e
                    confirmações por e-mail/WhatsApp (art. 7º, I).
                  </li>
                  <li>
                    <strong className="text-fg">Legítimo interesse:</strong> prevenção de fraude e
                    melhoria do serviço (art. 7º, IX).
                  </li>
                  <li>
                    <strong className="text-fg">Cumprimento de obrigação legal:</strong> retenção
                    fiscal e atendimento a autoridades (art. 7º, II).
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="mt-6 font-display text-[1.125rem] font-semibold text-fg">
                  Por quanto tempo guardamos
                </h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-fg-muted">
                  <li>
                    <strong className="text-fg">Reservas e histórico:</strong> 5 anos a contar do
                    último atendimento, para fins fiscais e contábeis.
                  </li>
                  <li>
                    <strong className="text-fg">Dados de cadastro (nome, telefone, e-mail):</strong>{' '}
                    enquanto sua conta estiver ativa neste estabelecimento.
                  </li>
                  <li>
                    <strong className="text-fg">Após exclusão:</strong> seus dados pessoais são
                    apagados em até 30 dias; reservas passadas ficam anonimizadas (sem nome,
                    telefone ou e-mail) apenas para estatísticas internas do estabelecimento.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="mt-6 font-display text-[1.125rem] font-semibold text-fg">
                  Onde os dados ficam armazenados
                </h2>
                <p className="mt-2 text-fg-muted">
                  A infraestrutura técnica (banco de dados, autenticação) é hospedada na Supabase,
                  com servidores fisicamente localizados nos Estados Unidos (AWS US-East). A
                  transferência internacional ocorre com base no art. 33, II da LGPD (cláusulas
                  contratuais padrão e medidas técnicas adequadas). Não há transferência dos seus
                  dados para outros países além desta hospedagem.
                </p>
              </section>

              <section>
                <h2 className="mt-6 font-display text-[1.125rem] font-semibold text-fg">
                  Cookies e armazenamento local
                </h2>
                <p className="mt-2 text-fg-muted">
                  Usamos apenas cookies estritamente necessários para manter você logado (cookie de
                  sessão) e armazenamento local do navegador para preferências de interface (ex:
                  tema). Não usamos cookies de rastreamento publicitário nem compartilhamos com
                  redes de anúncios.
                </p>
              </section>

              <section>
                <h2 className="mt-6 font-display text-[1.125rem] font-semibold text-fg">
                  Segurança
                </h2>
                <p className="mt-2 text-fg-muted">
                  Aplicamos isolamento por estabelecimento no banco (Row-Level Security do
                  PostgreSQL), criptografia em trânsito (HTTPS/TLS) e em repouso (criptografia do
                  banco). Acessos de equipe são auditados. Em caso de incidente de segurança que
                  afete seus dados, comunicaremos você e a ANPD conforme art. 48 da LGPD.
                </p>
              </section>

              <section>
                <h2 className="mt-6 font-display text-[1.125rem] font-semibold text-fg">
                  Encarregado pelo tratamento de dados (DPO)
                </h2>
                <p className="mt-2 text-fg-muted">
                  Para exercer seus direitos como titular ou esclarecer dúvidas sobre o tratamento
                  de dados, o encarregado da AraLabs pode ser contatado em{' '}
                  <a
                    href="mailto:dpo@aralabs.com.br"
                    className="font-medium text-brand-primary hover:underline"
                  >
                    dpo@aralabs.com.br
                  </a>
                  . Resposta em até 15 dias úteis.
                </p>
              </section>

              <section>
                <h2 className="mt-6 font-display text-[1.125rem] font-semibold text-fg">
                  Atualizações desta política
                </h2>
                <p className="mt-2 text-fg-muted">
                  Mudanças relevantes serão comunicadas no seu próximo acesso. Mudanças menores
                  (correção de redação) podem ocorrer sem aviso, mas a data de &ldquo;última
                  atualização&rdquo; abaixo é sempre mantida.
                </p>
              </section>

              <section>
                <h2 className="mt-6 font-display text-[1.125rem] font-semibold text-fg">Contato</h2>
                <p className="mt-2 text-fg-muted">
                  Fale diretamente com o estabelecimento para dúvidas sobre o atendimento, ou com a
                  AraLabs em{' '}
                  <a
                    href="mailto:contato@aralabs.com.br"
                    className="font-medium text-brand-primary hover:underline"
                  >
                    contato@aralabs.com.br
                  </a>{' '}
                  para questões sobre a plataforma. Veja também os{' '}
                  <Link
                    href="/termos-uso"
                    className="font-medium text-brand-primary hover:underline"
                  >
                    Termos de uso
                  </Link>
                  .
                </p>
              </section>

              <p className="mt-8 text-[0.75rem] text-fg-subtle">Última atualização: 2026-04-28.</p>
            </article>
          </main>
        </CustomerShell>
      </div>
    </>
  )
}
