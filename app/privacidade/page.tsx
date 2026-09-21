import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidade — Jards",
  description: "Como a Jards coleta, usa e protege seus dados.",
};

const UPDATED = "29 de agosto de 2026";

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-black/8 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-6">
          <Link href="/">
            <Image src="/jards-logo.svg" alt="Jards" width={75} height={24} className="h-6 w-auto" priority />
          </Link>
          <span className="h-5 w-px bg-black/12" />
          <span className="text-xs text-black/40">Política de Privacidade</span>
          <span className="ml-auto text-xs text-black/30">Atualizado em {UPDATED}</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-14">
        {/* Title */}
        <div className="mb-12 border-b border-black/8 pb-10">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[.12em] text-[#7259B5]">Documento legal</p>
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-[#0D0D0D]">Política de Privacidade</h1>
          <p className="text-base leading-7 text-black/50">
            Esta política explica quais dados a Jards coleta, por que os coleta,
            como os protege e quais são os seus direitos. Leia antes de usar a plataforma.
          </p>
        </div>

        <div className="space-y-10 text-sm leading-7 text-black/60">

          <Section id="s1" num="1" title="Quem somos">
            <p>
              A <strong>Jards</strong> é uma plataforma de CRM voltada para gestão de captação de
              patrocínio em projetos culturais e esportivos apoiados por leis de incentivo fiscal
              (Lei Rouanet, Lei de Incentivo ao Esporte, Lei do Audiovisual e similares).
            </p>
            <p>
              Operamos em <a href="https://jards.com.br" className="text-[#7259B5] hover:underline">jards.com.br</a>.
              Para fins da Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018), atuamos como{" "}
              <strong>controladores</strong> dos dados pessoais que você nos fornece diretamente,
              e como <strong>operadores</strong> dos dados que você insere na plataforma sobre
              seus contatos e parceiros comerciais.
            </p>
          </Section>

          <Section id="s2" num="2" title="Dados que coletamos">
            <h3 className="mt-5 mb-2 text-xs font-semibold uppercase tracking-[.08em] text-black/40">2.1 Dados de conta</h3>
            <p>Ao criar uma conta, coletamos nome completo, endereço de e-mail, senha (armazenada em hash, nunca em texto puro) e nome da organização.</p>

            <h3 className="mt-5 mb-2 text-xs font-semibold uppercase tracking-[.08em] text-black/40">2.2 Dados inseridos no CRM</h3>
            <p>Para gerenciar o pipeline de captação você pode inserir informações sobre patrocinadores, contatos, projetos, captações, atividades, documentos e comissões. Esses dados pertencem à sua organização.</p>

            <h3 className="mt-5 mb-2 text-xs font-semibold uppercase tracking-[.08em] text-black/40">2.3 Dados técnicos</h3>
            <p>Registramos automaticamente endereço IP, logs de sessão e histórico de alterações de campos críticos para segurança e auditoria. Esses dados não são usados para publicidade.</p>
          </Section>

          <Section id="s3" num="3" title="Integrações Google — Gmail e Agenda">
            <div className="my-4 rounded border border-[#7259B5]/20 border-l-2 border-l-[#7259B5] bg-[#F5F3FC] px-4 py-3">
              <p className="mb-1 text-xs font-semibold text-[#0D0D0D]">Declaração de uso limitado dos dados do Google</p>
              <p className="text-xs text-black/55">
                O uso dos dados obtidos pelas APIs do Google pela Jards está em conformidade com a{" "}
                <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-[#7259B5] hover:underline">
                  Política de dados do usuário dos serviços de API do Google
                </a>
                , incluindo os requisitos de uso limitado.
              </p>
            </div>

            <h3 className="mt-5 mb-2 text-xs font-semibold uppercase tracking-[.08em] text-black/40">3.1 Gmail (escopo: gmail.readonly)</h3>
            <p><strong>O que acessamos:</strong> remetente, destinatário, assunto, trecho e corpo em texto das mensagens, data/hora de envio.</p>
            <p><strong>Por que acessamos:</strong> para exibir, dentro do perfil de cada captação, os e-mails trocados com os contatos do patrocinador.</p>
            <p><strong>O que não fazemos com dados do Gmail:</strong></p>
            <ul className="mt-1 ml-4 list-disc space-y-1">
              <li>Não usamos para publicidade, pesquisa de mercado ou venda a terceiros</li>
              <li>Não usamos para treinar modelos de inteligência artificial</li>
              <li>Não lemos e-mails humanos — o acesso é exclusivamente técnico e automatizado</li>
              <li>Não transferimos a terceiros, salvo subprocessadores listados no §6</li>
            </ul>
            <p>
              Os tokens OAuth são criptografados com AES-256-GCM. Você pode revogar o acesso em{" "}
              <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-[#7259B5] hover:underline">
                myaccount.google.com/permissions
              </a>{" "}
              ou em <em>Configurações → Email</em> na Jards.
            </p>

            <h3 className="mt-5 mb-2 text-xs font-semibold uppercase tracking-[.08em] text-black/40">3.2 Google Agenda</h3>
            <p>Acessamos título, descrição, data/hora e participantes de eventos para sincronizar automaticamente atividades do tipo reunião cadastradas em captações. Tokens são criptografados com o mesmo padrão e revogáveis a qualquer momento.</p>
          </Section>

          <Section id="s4" num="4" title="Stripe — Pagamentos e assinatura">
            <p>
              O processamento de pagamentos é realizado pelo <strong>Stripe</strong>.
              A Jards <strong>nunca armazena dados de cartão</strong>. Armazenamos apenas
              metadados de assinatura: ID do cliente no Stripe, ID da assinatura/plano,
              data de renovação e plano ativo (Gratuito, Básico ou Profissional).
            </p>
          </Section>

          <Section id="s5" num="5" title="Como usamos os dados">
            <p>Usamos seus dados para prestar o serviço de CRM contratado, autenticar usuários, sincronizar integrações autorizadas, processar pagamentos, enviar notificações sobre o serviço e prevenir fraudes. <strong>Nunca usamos seus dados para publicidade de terceiros, nem os vendemos.</strong></p>
          </Section>

          <Section id="s6" num="6" title="Compartilhamento de dados">
            <p>Não vendemos nem alugamos dados pessoais. Compartilhamos apenas com subprocessadores que operam sob contrato:</p>
            <ul className="mt-2 ml-4 list-disc space-y-1">
              <li><strong>Supabase</strong> — banco de dados, autenticação e armazenamento (EUA, us-east-2)</li>
              <li><strong>Stripe</strong> — processamento de pagamentos (EUA / global)</li>
              <li><strong>Google LLC</strong> — APIs de Gmail e Agenda, somente quando autorizado (EUA / global)</li>
              <li><strong>Microsoft</strong> — API do Outlook/Agenda, somente quando autorizado (EUA / global)</li>
            </ul>
            <p>Podemos divulgar dados quando exigido por lei ou ordem judicial.</p>
          </Section>

          <Section id="s7" num="7" title="Armazenamento e segurança">
            <p>Dados armazenados na infraestrutura Supabase (AWS Ohio, EUA) com: criptografia em repouso (AES-256), TLS 1.2+ em trânsito, tokens OAuth criptografados com AES-256-GCM, isolamento por organização via Row Level Security e senhas armazenadas em hash bcrypt. Em caso de incidente, notificaremos em até 72 horas conforme a LGPD.</p>
          </Section>

          <Section id="s8" num="8" title="Retenção de dados">
            <p>Dados de conta e CRM são mantidos enquanto a organização estiver ativa e excluídos em até 30 dias após solicitação. Tokens OAuth são excluídos imediatamente ao desconectar a integração. Logs de auditoria são mantidos por 24 meses. Dados de pagamento são mantidos por 5 anos por obrigação fiscal.</p>
          </Section>

          <Section id="s9" num="9" title="Seus direitos (LGPD)">
            <p>Conforme a LGPD (Lei nº 13.709/2018), você pode solicitar: confirmação e acesso, correção, anonimização ou eliminação, portabilidade, revogação de consentimento, oposição ao tratamento e informação sobre compartilhamento. Envie sua solicitação para{" "}
              <a href="mailto:luan.antunes@jards.com.br" className="text-[#7259B5] hover:underline">luan.antunes@jards.com.br</a>.
              Atendemos em até 15 dias úteis. Você também pode acionar a ANPD em{" "}
              <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="text-[#7259B5] hover:underline">gov.br/anpd</a>.
            </p>
          </Section>

          <Section id="s10" num="10" title="Cookies">
            <p>Usamos apenas cookies essenciais: sessão de autenticação (HttpOnly, SameSite=Lax) e estado OAuth temporário (duração de 10 minutos, excluído após o fluxo). <strong>Não usamos cookies de rastreamento, analytics comportamental ou publicidade.</strong></p>
          </Section>

          <Section id="s11" num="11" title="Menores de idade">
            <p>A Jards é uma plataforma empresarial e profissional. Não coletamos intencionalmente dados de menores de 18 anos.</p>
          </Section>

          <Section id="s12" num="12" title="Alterações">
            <p>Alterações relevantes serão comunicadas por e-mail com pelo menos 15 dias de antecedência. A data no topo desta página indica sempre a versão mais recente.</p>
          </Section>

          <Section id="s13" num="13" title="Contato">
            <p>
              Dúvidas ou solicitações:{" "}
              <a href="mailto:luan.antunes@jards.com.br" className="text-[#7259B5] hover:underline">luan.antunes@jards.com.br</a>
            </p>
          </Section>
        </div>

        <div className="mt-14 border-t border-black/8 pt-8 text-xs text-black/30">
          <p>© 2026 Jards · Esta política é regida pela legislação brasileira · Última atualização: {UPDATED}</p>
          <p className="mt-2">
            <Link href="/termos" className="hover:text-black/60">Termos de Uso</Link>
            {" · "}
            <Link href="/privacidade" className="hover:text-black/60">Política de Privacidade</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

function Section({ id, num, title, children }: { id: string; num: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="mb-3 flex items-center gap-2.5 text-base font-bold text-[#0D0D0D]">
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-[#F0EDFB] text-[11px] font-bold text-[#7259B5]">{num}</span>
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
