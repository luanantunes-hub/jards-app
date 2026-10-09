"use client";

// Convite da primeira versão gratuita da prestação de contas: o seletor de
// módulos abre este modal quando a organização ainda não tem o módulo. Quem
// administra a organização ativa para a equipe (fn_prestacao_aceitar_convite_gratuito);
// as outras pessoas veem o convite e o pedido para falar com quem administra.

import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ModalPrestacao } from "@/components/prestacao/ModalPrestacao";

const ERROS: Record<string, string> = {
  sem_permissao: "Só quem administra a organização ativa o módulo.",
  ja_contratado: "A organização já tem a prestação de contas: peça acesso a quem administra.",
};

const INCLUI = [
  "O checklist do envio de cada lei, Rouanet, audiovisual, esporte e saúde, com a fonte de cada regra.",
  "Extrato, despesas e pagamentos conferidos sozinhos, com as pendências antes do envio.",
  "Metas, evidências, relatórios e o pacote do envio prontos para o sistema do órgão.",
];

export function ConvitePrestacao({ organizationId, podeAtivar, onClose, onAtivado }: {
  organizationId: string | null;
  /** Quem administra a organização ativa para a equipe. */
  podeAtivar: boolean;
  onClose: () => void;
  onAtivado: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [ativando, setAtivando] = useState(false);
  const [erro, setErro] = useState("");

  async function ativar() {
    if (!organizationId) return;
    setAtivando(true);
    setErro("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função nova, ainda fora do tipo Database
    const { error } = await (supabase as any).rpc("fn_prestacao_aceitar_convite_gratuito", { p_organization_id: organizationId });
    setAtivando(false);
    if (error) {
      const codigo = Object.keys(ERROS).find(c => error.message?.includes(c));
      setErro(codigo ? ERROS[codigo] : "Não foi possível ativar agora. Tente de novo em instantes.");
      return;
    }
    onAtivado();
  }

  return (
    <ModalPrestacao
      titulo="Prestação de contas no Jards"
      subtitulo="Primeira versão, grátis por tempo indeterminado"
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
              Ativar para a equipe
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[0.75rem] text-black/50">Quem administra a organização ativa para a equipe.</p>
          <button type="button" onClick={onClose} className="rounded bg-[#282525] px-5 py-2 text-[0.8125rem] font-semibold text-white transition hover:bg-[#3A3535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525] active:scale-[.98]">
            Entendi
          </button>
        </>
      )}
    >
      <div className="space-y-4 px-6 py-5 text-[0.8125rem] leading-relaxed text-black/70">
        <p>
          O Jards agora também cuida da prestação de contas dos seus projetos. Esta é a primeira versão do módulo, e ela é
          gratuita, por tempo indeterminado, para quem já usa o CRM.
        </p>
        <ul className="space-y-2">
          {INCLUI.map(item => (
            <li key={item} className="flex items-start gap-2">
              <CheckCircle2 size={14} aria-hidden className="mt-1 shrink-0 text-black/40" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="text-[0.75rem] text-black/50">
          Como é a primeira versão, ela vai mudar com o seu uso: conte para a gente o que faltar. Se um dia o módulo passar a
          ser cobrado, você fica sabendo antes, e nada do que registrou se perde.
        </p>
        {podeAtivar ? (
          <p className="text-[0.75rem] text-black/50">Ao ativar, todas as pessoas da equipe passam a usar a prestação de contas, menos captadores externos e proponentes.</p>
        ) : (
          <p className="text-[0.75rem] text-black/50">Peça a quem administra a organização para ativar: a ativação vale para a equipe toda.</p>
        )}
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#D94A4A47" }}>{erro}</p>}
      </div>
    </ModalPrestacao>
  );
}
