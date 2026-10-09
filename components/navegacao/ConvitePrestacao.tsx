"use client";

// Convite da primeira versão da prestação de contas: o seletor de módulos
// abre este modal quando a organização ainda não tem o módulo. Quem
// administra a organização começa o teste grátis de 45 dias para a equipe
// (fn_prestacao_aceitar_convite_gratuito); as outras pessoas veem o convite e
// o pedido para falar com quem administra.

import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ModalPrestacao } from "@/components/prestacao/ModalPrestacao";
import { AVISO_ANTES_DO_FIM_DIAS, fimDoTesteGratis, TESTE_GRATIS_DIAS } from "@/lib/modulos-contrato";
import { PRECO_MODULO_MENSAL, PRECO_VAGA_MENSAL } from "@/supabase/functions/_shared/cobranca-modulo";

const ERROS: Record<string, string> = {
  sem_permissao: "Só quem administra a organização começa o teste.",
  ja_contratado: "A organização já teve a prestação de contas: veja a assinatura em Meu plano.",
};

const INCLUI = [
  "O checklist do envio de cada lei, Rouanet, audiovisual, esporte e saúde, com a fonte de cada regra.",
  "Extrato, despesas e pagamentos conferidos sozinhos, com as pendências antes do envio.",
  "Metas, evidências, relatórios e o pacote do envio prontos para o sistema do órgão.",
];

const reais = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** 23/11/2026 */
const dataBr = (data: string) => data.split("-").reverse().join("/");

export function ConvitePrestacao({ organizationId, podeAtivar, onClose, onAtivado }: {
  organizationId: string | null;
  /** Quem administra a organização começa o teste para a equipe. */
  podeAtivar: boolean;
  onClose: () => void;
  onAtivado: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [ativando, setAtivando] = useState(false);
  const [erro, setErro] = useState("");
  const [ate] = useState(() => fimDoTesteGratis());

  async function ativar() {
    if (!organizationId) return;
    setAtivando(true);
    setErro("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função nova, ainda fora do tipo Database
    const { error } = await (supabase as any).rpc("fn_prestacao_aceitar_convite_gratuito", { p_organization_id: organizationId });
    setAtivando(false);
    if (error) {
      const codigo = Object.keys(ERROS).find(c => error.message?.includes(c));
      setErro(codigo ? ERROS[codigo] : "Não foi possível começar o teste agora. Tente de novo em instantes.");
      return;
    }
    onAtivado();
  }

  return (
    <ModalPrestacao
      titulo="Prestação de contas no Jards"
      subtitulo={`Primeira versão, ${TESTE_GRATIS_DIAS} dias grátis para a equipe`}
      onClose={onClose}
      largura="max-w-[32rem]"
      rodape={podeAtivar ? (
        <>
          <span />
          <div className="flex items-center gap-4">
            <button type="button" onClick={onClose} className="rounded px-2 py-2 text-[0.8125rem] text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
              Agora não
            </button>
            <button
              type="button"
              onClick={ativar}
              disabled={ativando || !organizationId}
              className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2 text-[0.8125rem] font-semibold text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {ativando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" aria-hidden />}
              Começar o teste grátis
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[0.75rem] text-black/50">Quem administra a organização começa o teste para a equipe.</p>
          <button type="button" onClick={onClose} className="rounded bg-[#282525] px-5 py-2 text-[0.8125rem] font-semibold text-white transition hover:bg-[#3A3535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525] active:scale-[.98]">
            Entendi
          </button>
        </>
      )}
    >
      <div className="space-y-4 px-6 py-5 text-[0.8125rem] leading-relaxed text-black/70">
        <p>
          O Jards agora também cuida da prestação de contas dos seus projetos. Esta é a primeira versão do módulo, e quem já
          usa o CRM pode testar tudo, com a equipe, por {TESTE_GRATIS_DIAS} dias, sem pagar e sem cadastrar cartão.
        </p>
        <ul className="space-y-2">
          {INCLUI.map(item => (
            <li key={item} className="flex items-start gap-2">
              <CheckCircle2 size={14} aria-hidden className="mt-1 shrink-0 text-black/40" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div className="rounded border border-black/[.08] px-4 py-3">
          <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Depois do teste</p>
          <p className="mt-1.5">
            Para continuar editando, a assinatura custa <span className="font-medium text-[#282525]">{reais(PRECO_MODULO_MENSAL)} por mês</span>, com
            1 usuário, mais {reais(PRECO_VAGA_MENSAL)} por usuário extra. Sem assinatura, nada se perde: as prestações e os
            arquivos ficam guardados para consulta e exportação.
          </p>
          <p className="mt-1.5 text-[0.75rem] text-black/50">Quem administra recebe um aviso {AVISO_ANTES_DO_FIM_DIAS} dias antes do fim.</p>
        </div>

        <p className="text-[0.75rem] text-black/50">
          Como é a primeira versão, ela vai mudar com o seu uso: conte para a gente o que faltar.
        </p>
        {podeAtivar ? (
          <p className="text-[0.75rem] text-black/50">
            Ao começar, o teste vai até {dataBr(ate)}, e todas as pessoas da equipe passam a usar a prestação de contas, menos
            captadores externos e proponentes.
          </p>
        ) : (
          <p className="text-[0.75rem] text-black/50">Peça a quem administra a organização para começar: o teste vale para a equipe toda.</p>
        )}
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#D94A4A47" }}>{erro}</p>}
      </div>
    </ModalPrestacao>
  );
}
