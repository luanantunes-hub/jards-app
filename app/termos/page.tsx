import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Termos de Uso — Jards",
  description: "Condições para uso da plataforma Jards.",
};

const UPDATED = "19 de outubro de 2026";

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-black/8 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-6">
          <Link href="/">
            <Image src="/jards-logo.svg" alt="Jards" width={75} height={24} className="h-6 w-auto" priority />
          </Link>
          <span className="h-5 w-px bg-black/12" />
          <span className="text-xs text-black/40">Termos de Uso</span>
          <span className="ml-auto text-xs text-black/30">Atualizado em {UPDATED}</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-14">
        {/* Title */}
        <div className="mb-12 border-b border-black/8 pb-10">
          <p className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[.12em] text-[#7259B5]">Documento legal</p>
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-[#282525]">Termos de Uso</h1>
          <p className="text-base leading-7 text-black/50">
            Ao criar uma conta ou usar a plataforma Jards, você concorda com estes termos.
            Leia com atenção antes de utilizar o serviço.
          </p>
        </div>

        <div className="space-y-10 text-sm leading-7 text-black/60">

          <Section id="s1" num="1" title="Aceitação dos termos">
            <p>
              Estes Termos de Uso (&ldquo;Termos&rdquo;) regem o acesso e o uso da plataforma Jards,
              disponível em <a href="https://jards.com.br" className="text-[#7259B5] hover:underline">jards.com.br</a>.
              Ao criar uma conta, você declara ter lido, compreendido e aceito integralmente estes Termos.
              Se você age em nome de uma organização, declara ter autoridade para vinculá-la a este acordo.
            </p>
          </Section>

          <Section id="s2" num="2" title="Descrição do serviço">
            <p>
              A Jards é uma plataforma de CRM (Customer Relationship Management) voltada para
              equipes que captam patrocínio por meio de leis de incentivo fiscal brasileiras,
              incluindo Lei Rouanet, Lei de Incentivo ao Esporte e Lei do Audiovisual.
            </p>
            <p>
              O serviço inclui: gestão de pipeline de captação, base de patrocinadores,
              acompanhamento de editais, integração com Google Agenda e Gmail,
              gestão de projetos e contatos, e relatórios de desempenho comercial.
              Funcionalidades estão sujeitas ao plano contratado.
            </p>
          </Section>

          <Section id="s3" num="3" title="Contas e organizações">
            <p>
              Cada conta é pessoal e intransferível. Você é responsável por manter a
              confidencialidade das suas credenciais e por toda atividade realizada em sua conta.
            </p>
            <p>
              Ao criar uma organização no Jards, você torna-se administrador desse workspace.
              Você pode convidar membros, que terão acesso aos dados da organização conforme
              as permissões configuradas. O administrador é responsável pelo uso da plataforma
              por todos os membros da sua organização.
            </p>
            <p>
              Você concorda em: fornecer informações verdadeiras, não criar contas falsas,
              não compartilhar credenciais e notificar-nos imediatamente em caso de uso
              não autorizado da sua conta.
            </p>
          </Section>

          <Section id="s4" num="4" title="Uso aceitável">
            <p>Você concorda em usar a Jards apenas para fins legais e em conformidade com estes Termos. É proibido:</p>
            <ul className="mt-2 ml-4 list-disc space-y-1">
              <li>Usar a plataforma para atividades ilegais, fraudulentas ou antiéticas</li>
              <li>Tentar acessar sistemas ou dados de outras organizações</li>
              <li>Realizar engenharia reversa, descompilar ou copiar o software</li>
              <li>Usar scraping automatizado ou bots sem autorização prévia</li>
              <li>Interferir no funcionamento ou na segurança da plataforma</li>
              <li>Revender, sublicenciar ou redistribuir o serviço sem autorização</li>
              <li>Inserir dados de terceiros sem base legal adequada (conforme LGPD)</li>
            </ul>
          </Section>

          <Section id="s5" num="5" title="Planos e pagamento">
            <p>
              A Jards oferece planos gratuito, básico e profissional. Os preços e funcionalidades
              de cada plano estão disponíveis em <a href="https://jards.com.br/precos" className="text-[#7259B5] hover:underline">jards.com.br/precos</a>.
            </p>
            <p>
              Pagamentos são processados pelo Stripe. Assinaturas são cobradas de forma recorrente,
              todo mês. O cancelamento pode ser feito a qualquer
              momento em <em>Configurações → Meu Plano</em>; o acesso permanece ativo até o fim
              do período já pago, sem reembolso proporcional.
            </p>
            <p>
              Reservamo-nos o direito de alterar preços com aviso prévio de 30 dias. Alterações
              de preço não afetam assinaturas ativas até o próximo ciclo de renovação.
            </p>
          </Section>

          <Section id="s6" num="6" title="Propriedade dos dados">
            <p>
              <strong>Seus dados são seus.</strong> Todo conteúdo inserido na plataforma
              (captações, empresas, contatos, projetos, documentos) pertence à sua organização.
              A Jards não reivindica propriedade sobre esses dados.
            </p>
            <p>
              Ao usar a plataforma, você nos concede uma licença limitada, não exclusiva e
              não transferível para armazenar e processar seus dados exclusivamente com o
              fim de prestar o serviço contratado.
            </p>
            <p>
              Você pode exportar seus dados a qualquer momento. Em caso de encerramento
              de conta, disponibilizamos um período de 30 dias para exportação antes da exclusão.
            </p>
          </Section>

          <Section id="s7" num="7" title="Propriedade intelectual">
            <p>
              A plataforma Jards, incluindo software, design, logotipos, textos e funcionalidades,
              é de propriedade exclusiva da Jards e protegida por direitos autorais e outras leis
              de propriedade intelectual. Estes Termos não concedem qualquer direito sobre a
              propriedade intelectual da Jards além do uso do serviço conforme descrito.
            </p>
          </Section>

          <Section id="s8" num="8" title="Disponibilidade e SLA">
            <p>
              Nos esforçamos para manter a plataforma disponível, mas não garantimos disponibilidade
              ininterrupta. Manutenções programadas serão comunicadas com antecedência.
              Não nos responsabilizamos por indisponibilidades causadas por terceiros (provedores
              de infraestrutura, APIs externas) ou eventos fora do nosso controle.
            </p>
          </Section>

          <Section id="s9" num="9" title="Limitação de responsabilidade">
            <p>
              Na máxima extensão permitida pela lei, a Jards não se responsabiliza por danos
              indiretos, incidentais, especiais ou consequenciais decorrentes do uso ou
              incapacidade de uso da plataforma, incluindo perda de dados, perda de receita
              ou interrupção de negócios.
            </p>
            <p>
              A responsabilidade total da Jards perante você está limitada ao valor pago
              nos 12 meses anteriores ao evento que originou a reclamação, ou R$ 100,00,
              o que for maior.
            </p>
          </Section>

          <Section id="s10" num="10" title="Rescisão">
            <p>
              Você pode encerrar sua conta a qualquer momento em <em>Configurações → Meu Plano</em>.
              A Jards pode suspender ou encerrar contas que violem estes Termos, com ou sem aviso prévio.
            </p>
            <p>
              Em caso de encerramento, seus dados ficam disponíveis por 30 dias para exportação.
              Após esse prazo, são excluídos permanentemente, ressalvados dados que tenhamos
              obrigação legal de reter.
            </p>
          </Section>

          <Section id="s11" num="11" title="Privacidade">
            <p>
              O tratamento de dados pessoais é regido pela nossa{" "}
              <Link href="/privacidade" className="text-[#7259B5] hover:underline">
                Política de Privacidade
              </Link>
              , que integra estes Termos por referência.
            </p>
          </Section>

          <Section id="s12" num="12" title="Alterações nos termos">
            <p>
              Podemos atualizar estes Termos periodicamente. Alterações relevantes serão
              comunicadas por e-mail com pelo menos 15 dias de antecedência. O uso continuado
              da plataforma após a vigência das alterações implica aceitação da nova versão.
            </p>
          </Section>

          <Section id="s13" num="13" title="Lei aplicável e foro">
            <p>
              Estes Termos são regidos pela legislação brasileira. Fica eleito o foro da
              Comarca de São Paulo, SP, para dirimir quaisquer controvérsias decorrentes
              deste instrumento, com renúncia a qualquer outro, por mais privilegiado que seja.
            </p>
          </Section>

          <Section id="s14" num="14" title="Contato">
            <p>
              Dúvidas sobre estes Termos:{" "}
              <a href="mailto:luan.antunes@jards.com.br" className="text-[#7259B5] hover:underline">
                luan.antunes@jards.com.br
              </a>
            </p>
          </Section>
        </div>

        <div className="mt-14 border-t border-black/8 pt-8 text-xs text-black/30">
          <p>© 2026 Jards · Esta política é regida pela legislação brasileira · Última atualização: {UPDATED}</p>
          <p className="mt-2">
            <Link href="/termos" className="hover:text-black/60">Termos de Uso</Link>
            {" · "}
            <Link href="/privacidade" className="hover:text-black/60">Política de Privacidade</Link>
            {" · "}
            <button type="button" data-preferencias-cookies className="hover:text-black/60">Preferências de cookies</button>
          </p>
        </div>
      </main>
      <Script src="/consentimento.js" strategy="afterInteractive" />
    </div>
  );
}

function Section({ id, num, title, children }: { id: string; num: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="mb-3 flex items-center gap-2.5 text-base font-bold text-[#282525]">
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-black/[.04] text-[0.6875rem] font-bold text-[#7259B5]">{num}</span>
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
