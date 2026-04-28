import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { ThemeInjector } from '@/components/branding/theme-injector'
import { TenantLogo } from '@/components/branding/tenant-logo'
import { CustomerShell } from '@/components/customer/customer-shell'

export default async function TermsOfUsePage() {
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
                    Termos de uso
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
                Termos de uso
              </h1>
              <p className="text-fg-muted">
                Estes termos regem o uso do agendamento online de{' '}
                <strong>{tenant.name}</strong>, fornecido pela plataforma AraLabs. Ao usar o
                serviço, você concorda com o que está abaixo.
              </p>

              <section>
                <h2 className="mt-6 font-display text-[1.125rem] font-semibold text-fg">
                  Quem somos
                </h2>
                <p className="mt-2 text-fg-muted">
                  <strong className="text-fg">{tenant.name}</strong> é o estabelecimento que
                  oferece os serviços agendados. <strong className="text-fg">AraLabs</strong> é a
                  empresa que opera a plataforma técnica de agendamento. Os termos comerciais do
                  serviço (preço, qualidade, política de atendimento) são de responsabilidade do
                  estabelecimento. A AraLabs responde pela disponibilidade e segurança da
                  plataforma.
                </p>
              </section>

              <section>
                <h2 className="mt-6 font-display text-[1.125rem] font-semibold text-fg">
                  Sua conta
                </h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-fg-muted">
                  <li>
                    Você acessa com seu e-mail pessoal. Mantenha o acesso ao e-mail seguro — quem
                    tiver acesso pode fazer reservas em seu nome.
                  </li>
                  <li>
                    Os dados de cadastro (nome, telefone) devem ser verdadeiros. Reservas com
                    dados falsos podem ser canceladas pelo estabelecimento.
                  </li>
                  <li>
                    Sua conta é pessoal e intransferível.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="mt-6 font-display text-[1.125rem] font-semibold text-fg">
                  Reservas
                </h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-fg-muted">
                  <li>
                    A reserva é confirmada quando aparece com status &ldquo;Confirmada&rdquo; na
                    sua tela{' '}
                    <Link href="/meus-agendamentos" className="font-medium text-brand-primary hover:underline">
                      Meus agendamentos
                    </Link>
                    .
                  </li>
                  <li>
                    O estabelecimento pode cancelar ou reagendar reservas em casos de força maior
                    (profissional indisponível, problema técnico, etc). Você será avisado.
                  </li>
                  <li>
                    Você pode cancelar suas reservas dentro da janela permitida (configurada pelo
                    estabelecimento). Fora dessa janela, entre em contato direto.
                  </li>
                  <li>
                    Não comparecer (no-show) repetidamente pode resultar em bloqueio do seu
                    cadastro neste estabelecimento.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="mt-6 font-display text-[1.125rem] font-semibold text-fg">
                  Conduta proibida
                </h2>
                <p className="mt-2 text-fg-muted">Você não pode:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-fg-muted">
                  <li>Criar reservas em nome de terceiros sem autorização.</li>
                  <li>Fazer reservas em massa para revenda ou bloqueio de horários.</li>
                  <li>Usar o serviço para qualquer finalidade ilícita.</li>
                  <li>Tentar acessar ou modificar dados que não sejam seus (engenharia reversa, exploits, etc).</li>
                </ul>
                <p className="mt-2 text-fg-muted">
                  Violações podem resultar em bloqueio imediato e responsabilização legal.
                </p>
              </section>

              <section>
                <h2 className="mt-6 font-display text-[1.125rem] font-semibold text-fg">
                  Disponibilidade do serviço
                </h2>
                <p className="mt-2 text-fg-muted">
                  Trabalhamos para manter a plataforma disponível 24/7, mas pode haver
                  interrupções por manutenção, falhas de terceiros (provedor de internet,
                  hospedagem) ou eventos imprevistos. Não garantimos disponibilidade
                  ininterrupta. Em caso de indisponibilidade, contate o estabelecimento por
                  outros canais (telefone, WhatsApp).
                </p>
              </section>

              <section>
                <h2 className="mt-6 font-display text-[1.125rem] font-semibold text-fg">
                  Limitação de responsabilidade
                </h2>
                <p className="mt-2 text-fg-muted">
                  A AraLabs responde pela operação técnica da plataforma. Para questões sobre o
                  atendimento, qualidade do serviço, valores cobrados ou problemas durante a
                  execução, entre em contato direto com o estabelecimento. Em nenhum caso a
                  AraLabs será responsável por danos indiretos, lucros cessantes ou prejuízos
                  decorrentes do uso ou impossibilidade de uso da plataforma, exceto nos limites
                  da legislação aplicável.
                </p>
              </section>

              <section>
                <h2 className="mt-6 font-display text-[1.125rem] font-semibold text-fg">
                  Privacidade
                </h2>
                <p className="mt-2 text-fg-muted">
                  O tratamento dos seus dados pessoais é descrito em detalhe na nossa{' '}
                  <Link href="/politica-privacidade" className="font-medium text-brand-primary hover:underline">
                    Política de privacidade
                  </Link>
                  .
                </p>
              </section>

              <section>
                <h2 className="mt-6 font-display text-[1.125rem] font-semibold text-fg">
                  Alterações dos termos
                </h2>
                <p className="mt-2 text-fg-muted">
                  Estes termos podem ser atualizados periodicamente. Mudanças relevantes serão
                  comunicadas no seu próximo acesso. O uso continuado após a comunicação implica
                  aceitação dos novos termos.
                </p>
              </section>

              <section>
                <h2 className="mt-6 font-display text-[1.125rem] font-semibold text-fg">
                  Lei aplicável e foro
                </h2>
                <p className="mt-2 text-fg-muted">
                  Estes termos são regidos pelas leis da República Federativa do Brasil. Fica
                  eleito o foro da comarca de Arapongas/PR para dirimir quaisquer controvérsias,
                  ressalvado o direito do consumidor de optar pelo foro do seu domicílio quando
                  aplicável o Código de Defesa do Consumidor.
                </p>
              </section>

              <section>
                <h2 className="mt-6 font-display text-[1.125rem] font-semibold text-fg">Contato</h2>
                <p className="mt-2 text-fg-muted">
                  Plataforma:{' '}
                  <a
                    href="mailto:contato@aralabs.com.br"
                    className="font-medium text-brand-primary hover:underline"
                  >
                    contato@aralabs.com.br
                  </a>
                  . Atendimento neste estabelecimento: contate{' '}
                  <strong className="text-fg">{tenant.name}</strong> diretamente.
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
