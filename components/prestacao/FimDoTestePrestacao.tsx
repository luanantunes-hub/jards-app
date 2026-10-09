"use client";

// Fim do teste grátis da primeira versão da prestação de contas: abre uma vez
// por sessão do navegador, quando a pessoa entra no módulo depois do fim do
// teste. Explica que nada se perdeu, que agora o módulo é só para consulta e
// quanto custa voltar a editar. Quem administra assina dali mesmo: o botão
// abre o pagamento no Stripe (POST /api/prestacao/assinatura) com um usuário
// para cada pessoa da equipe que usa o módulo; outra quantidade se escolhe em
// Meu plano. As outras pessoas são lembradas de falar com quem administra.

import { useState } from "react";
import Link from "next/link";
import { ModalIlustrado } from "@/components/ui/ModalIlustrado";
import { TESTE_GRATIS_DIAS } from "@/lib/modulos-contrato";
import { VAGAS_EXTRAS_MAX } from "@/supabase/functions/_shared/cobranca-modulo";

const reais = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function FimDoTestePrestacao({ organizationId, ate, admin, emUso, precos, cobrancaConfigurada, onClose }: {
  organizationId: string;
  /** Último dia do teste (AAAA-MM-DD). */
  ate: string;
  admin: boolean;
  /** Pessoas da equipe com acesso à prestação. */
  emUso: number;
  precos: { modulo: number; vaga: number };
  cobrancaConfigurada: boolean;
  onClose: () => void;
}) {
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState("");
  const extras = Math.min(VAGAS_EXTRAS_MAX, Math.max(0, emUso - 1));
  const total = precos.modulo + extras * precos.vaga;

  async function assinar() {
    setErro("");
    setAbrindo(true);
    const resposta = await fetch("/api/prestacao/assinatura", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organization_id: organizationId, vagas_extras: extras }),
    }).catch(() => null);
    const json = await resposta?.json().catch(() => ({})) as { url?: string; error?: string } | undefined;
    if (!resposta?.ok || !json?.url) {
      setErro(json?.error ?? "Não foi possível abrir o pagamento. Tente de novo ou assine em Meu plano.");
      setAbrindo(false);
      return;
    }
    window.location.assign(json.url);
  }

  return (
    <ModalIlustrado
      onClose={onClose}
      passos={[{
        imagem: { src: "/illustrations/tamandua-contador.png", largura: 900, altura: 547, alt: "Tamanduá do Jards fazendo as contas na mesa, com a calculadora e os papéis" },
        rotulo: "Prestação de contas · primeira versão",
        titulo: "O teste grátis terminou",
        conteudo: (
          <>
            <p>
              Os {TESTE_GRATIS_DIAS} dias do teste terminaram em {ate.split("-").reverse().join("/")}. Obrigado por testar a
              primeira versão.
            </p>
            <p>
              Nada foi apagado: as prestações, os comprovantes e os arquivos continuam aqui para consulta e exportação. A
              edição volta assim que a organização assinar.
            </p>
            <div className="rounded border border-black/[.08] px-4 py-3">
              <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Assinatura</p>
              <p className="mt-1.5">
                <span className="font-medium text-[#282525]">{reais(precos.modulo)} por mês</span>, com 1 usuário. Usuário
                extra: {reais(precos.vaga)} por mês.
              </p>
              {admin && extras > 0 && (
                <p className="mt-1.5">
                  Para as {emUso} pessoas da equipe que usam a prestação:{" "}
                  <span className="font-medium tabular-nums text-[#282525]">{reais(total)} por mês</span>.
                </p>
              )}
              {admin && (
                <p className="mt-1.5 text-[0.75rem] text-black/50">
                  O pagamento abre no Stripe, com cartão.{" "}
                  <Link href="/meu-plano?assinar=prestacao" onClick={onClose}
                    className="rounded underline decoration-black/25 underline-offset-2 transition hover:text-black/75 hover:decoration-black/60 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                    Escolher outra quantidade em Meu plano
                  </Link>
                </p>
              )}
            </div>
            <p className="text-[0.75rem] text-black/50">
              {admin
                ? "Se faltou alguma coisa na primeira versão, conte para a gente: é isso que decide as próximas."
                : "Peça a quem administra a organização para assinar: a assinatura vale para a equipe."}
            </p>
            {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#D94A4A47" }}>{erro}</p>}
          </>
        ),
      }]}
      acoesFinais={admin ? (
        <>
          <button type="button" onClick={onClose} className="rounded px-2 py-2 text-[0.8125rem] text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
            Só consultar
          </button>
          <button
            type="button"
            data-principal
            onClick={assinar}
            disabled={abrindo || !cobrancaConfigurada}
            className="flex items-center gap-1.5 rounded bg-[#282525] px-5 py-2.5 text-[0.8125rem] font-semibold text-white transition hover:bg-[#3A3535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {abrindo && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" aria-hidden />}
            {abrindo ? "Abrindo o pagamento…" : cobrancaConfigurada ? "Assinar agora" : "Pagamento indisponível"}
          </button>
        </>
      ) : (
        <button type="button" data-principal onClick={onClose} className="rounded bg-[#282525] px-5 py-2.5 text-[0.8125rem] font-semibold text-white transition hover:bg-[#3A3535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525] active:scale-[.98]">
          Entendi
        </button>
      )}
    />
  );
}
