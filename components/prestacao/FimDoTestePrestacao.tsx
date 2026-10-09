"use client";

// Fim do teste grátis da primeira versão da prestação de contas: abre uma vez
// por sessão do navegador, quando a pessoa entra no módulo depois do fim do
// teste. Explica que nada se perdeu, que agora o módulo é só para consulta e
// quanto custa voltar a editar. Quem administra vai para a assinatura em Meu
// plano; as outras pessoas são lembradas de falar com quem administra.

import Link from "next/link";
import { ModalIlustrado } from "@/components/ui/ModalIlustrado";
import { TESTE_GRATIS_DIAS } from "@/lib/modulos-contrato";

const reais = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function FimDoTestePrestacao({ ate, admin, emUso, precos, onClose }: {
  /** Último dia do teste (AAAA-MM-DD). */
  ate: string;
  admin: boolean;
  /** Pessoas da equipe com acesso à prestação. */
  emUso: number;
  precos: { modulo: number; vaga: number };
  onClose: () => void;
}) {
  return (
    <ModalIlustrado
      onClose={onClose}
      passos={[{
        imagem: { src: "/email/tamandua-telefone.png", largura: 640, altura: 274, alt: "Tamanduá do Jards ao telefone" },
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
              {emUso > 1 && (
                <p className="mt-1.5 text-[0.75rem] text-black/50">Hoje {emUso} pessoas da equipe usam a prestação de contas.</p>
              )}
            </div>
            <p className="text-[0.75rem] text-black/50">
              {admin
                ? "Se faltou alguma coisa na primeira versão, conte para a gente: é isso que decide as próximas."
                : "Peça a quem administra a organização para assinar: a assinatura vale para a equipe."}
            </p>
          </>
        ),
      }]}
      acoesFinais={admin ? (
        <>
          <button type="button" onClick={onClose} className="rounded px-2 py-2 text-[0.8125rem] text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
            Só consultar
          </button>
          <Link
            href="/meu-plano?assinar=prestacao"
            data-principal
            onClick={onClose}
            className="rounded bg-[#282525] px-5 py-2.5 text-[0.8125rem] font-semibold text-white transition hover:bg-[#3A3535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525] active:scale-[.98]"
          >
            Assinar
          </Link>
        </>
      ) : (
        <button type="button" data-principal onClick={onClose} className="rounded bg-[#282525] px-5 py-2.5 text-[0.8125rem] font-semibold text-white transition hover:bg-[#3A3535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525] active:scale-[.98]">
          Entendi
        </button>
      )}
    />
  );
}
