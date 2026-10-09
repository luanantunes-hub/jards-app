"use client";

// Convite da primeira versão da prestação de contas: o seletor de módulos
// abre este modal quando a organização ainda não tem o módulo. São três
// passos com o tamanduá: a novidade, o que o módulo faz e o teste grátis de
// 45 dias. Quem administra a organização começa o teste para a equipe
// (fn_prestacao_aceitar_convite_gratuito); as outras pessoas veem o convite e
// o pedido para falar com quem administra.

import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ModalIlustrado, type PassoIlustrado } from "@/components/ui/ModalIlustrado";
import { AVISO_ANTES_DO_FIM_DIAS, fimDoTesteGratis, TESTE_GRATIS_DIAS } from "@/lib/modulos-contrato";
import { PRECO_MODULO_MENSAL, PRECO_VAGA_MENSAL } from "@/supabase/functions/_shared/cobranca-modulo";

const ERROS: Record<string, string> = {
  sem_permissao: "Só quem administra a organização começa o teste.",
  ja_contratado: "A organização já teve a prestação de contas: veja a assinatura em Meu plano.",
};

const INCLUI = [
  "O checklist do envio de cada lei, com a fonte de cada regra.",
  "Extrato, despesas e pagamentos conferidos sozinhos, com as pendências antes do envio.",
  "Metas, evidências, relatórios e o pacote pronto para o sistema do órgão.",
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

  const passos: PassoIlustrado[] = [
    {
      imagem: { src: "/email/tamandua-celular.png", largura: 300, altura: 341, alt: "Tamanduá do Jards mostrando a novidade no celular" },
      rotulo: "Novidade · primeira versão",
      titulo: "A prestação de contas chegou ao Jards",
      conteudo: (
        <>
          <p>
            O mesmo lugar onde você capta agora cuida da prestação de contas dos seus projetos incentivados: Rouanet,
            audiovisual, esporte e saúde.
          </p>
          <p className="text-[0.75rem] text-black/50">
            É a primeira versão do módulo, e ela vai mudar com o seu uso: conte para a gente o que faltar.
          </p>
        </>
      ),
    },
    {
      imagem: { src: "/email/tamandua-escrevendo.png", largura: 520, altura: 272, alt: "Tamanduá do Jards conferindo papéis" },
      rotulo: "O que ela faz",
      titulo: "Menos planilha, menos susto na análise",
      conteudo: (
        <ul className="space-y-2">
          {INCLUI.map(item => (
            <li key={item} className="flex items-start gap-2">
              <CheckCircle2 size={14} aria-hidden className="mt-1 shrink-0 text-black/40" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      imagem: { src: "/email/tamandua-brinde.png", largura: 168, altura: 222, alt: "Tamanduá do Jards brindando" },
      rotulo: `${TESTE_GRATIS_DIAS} dias grátis`,
      titulo: "Teste com a sua equipe, sem cartão",
      conteudo: (
        <>
          <p>
            Por {TESTE_GRATIS_DIAS} dias, tudo liberado para a equipe. Depois, para continuar editando, a assinatura custa{" "}
            <span className="font-medium text-[#282525]">{reais(PRECO_MODULO_MENSAL)} por mês</span>, com 1 usuário, mais{" "}
            {reais(PRECO_VAGA_MENSAL)} por usuário extra.
          </p>
          <p>Sem assinatura, nada se perde: as prestações e os arquivos ficam guardados para consulta e exportação.</p>
          <p className="text-[0.75rem] text-black/50">
            {podeAtivar
              ? `O teste vai até ${dataBr(ate)}, e você recebe um aviso ${AVISO_ANTES_DO_FIM_DIAS} dias antes do fim. Captadores externos e proponentes ficam de fora.`
              : "Peça a quem administra a organização para começar: o teste vale para a equipe toda."}
          </p>
          {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#D94A4A47" }}>{erro}</p>}
        </>
      ),
    },
  ];

  return (
    <ModalIlustrado
      passos={passos}
      onClose={onClose}
      acoesFinais={podeAtivar ? (
        <button
          type="button"
          data-principal
          onClick={ativar}
          disabled={ativando || !organizationId}
          className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2.5 text-[0.8125rem] font-semibold text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {ativando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" aria-hidden />}
          Começar o teste grátis
        </button>
      ) : (
        <button type="button" data-principal onClick={onClose} className="rounded bg-[#282525] px-5 py-2.5 text-[0.8125rem] font-semibold text-white transition hover:bg-[#3A3535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525] active:scale-[.98]">
          Entendi
        </button>
      )}
    />
  );
}
