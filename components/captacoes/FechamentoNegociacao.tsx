"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { CampoValor } from "@/components/ui/CampoValor";
import { RenovarCicloModal } from "@/components/modals/RenovarCicloModal";
import { MENSAGEM_VALOR_INVALIDO, formatarValorBRL, lerValorBRL } from "@/lib/valor";

// Supabase sem a tipagem das RPCs usadas aqui.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type NegociacaoParaFechar = {
  id: string;
  projeto_id: string | null;
  valor_solicitado: number | null;
};

/**
 * Único caminho para ganhar uma negociação, em qualquer tela (topo, menu de
 * status, kanban): pede o valor fechado; com projeto, a proposta recebe esse
 * valor e é aceita (venda, cliente e entregas); sem projeto, a negociação é
 * aprovada com o valor. O banco cria o cliente nos dois casos.
 */
export function FecharNegocioSheet({ captacao, empresaNome, propostaAceitaId, onClose, onChanged }: {
  captacao: NegociacaoParaFechar;
  empresaNome: string;
  /** Proposta já aceita: só conclui o aceite. Sem informar, é procurada aqui. */
  propostaAceitaId?: string | null;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const db: Db = useMemo(() => createClient(), []);
  const comProjeto = Boolean(captacao.projeto_id);
  const [aceitaEncontrada, setAceitaEncontrada] = useState<{ id: string; valor: number | null } | null>(null);
  const aceitaId = propostaAceitaId ?? aceitaEncontrada?.id ?? null;
  const [valorTexto, setValorTexto] = useState(() => formatarValorBRL(captacao.valor_solicitado));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const campoValor = useId();
  const lido = lerValorBRL(valorTexto);

  useEffect(() => {
    if (!comProjeto || propostaAceitaId !== undefined) return;
    let ativo = true;
    db.from("propostas").select("id, valor_proposto").eq("captacao_id", captacao.id).eq("status", "aceita").limit(1).maybeSingle()
      .then(({ data }: { data: { id: string; valor_proposto: number | null } | null }) => {
        if (!ativo || !data) return;
        setAceitaEncontrada({ id: data.id, valor: data.valor_proposto });
        if (data.valor_proposto != null) setValorTexto(formatarValorBRL(data.valor_proposto));
      });
    return () => { ativo = false; };
  }, [captacao.id, comProjeto, db, propostaAceitaId]);

  async function fechar(close: () => void) {
    if (!lido.valido) { setErro(MENSAGEM_VALOR_INVALIDO); return; }
    if (lido.valor == null) { setErro("Informe o valor fechado."); return; }
    setSalvando(true);
    setErro(null);
    let falha: string | null = null;
    if (comProjeto) {
      let propostaId = aceitaId;
      if (!propostaId) {
        const proposta = await db.rpc("fn_salvar_proposta_simplificada", { p_captacao_id: captacao.id, p_valor: lido.valor });
        if (proposta.error || !proposta.data) falha = proposta.error?.message ?? "Não foi possível registrar a proposta.";
        else propostaId = proposta.data;
      }
      if (propostaId) {
        const aceite = await db.rpc("fn_aceitar_proposta_comercial", { p_proposta_id: propostaId });
        if (aceite.error) falha = aceite.error.message;
      }
    } else {
      const { data, error } = await db.from("captacoes").update({ status: "aprovado", valor_aprovado: lido.valor }).eq("id", captacao.id).select("id").maybeSingle();
      if (error || !data) falha = error?.message ?? "Não foi possível fechar a negociação.";
    }
    setSalvando(false);
    if (falha) { setErro(falha); return; }
    await onChanged();
    close();
  }

  return (
    <BottomSheet
      titulo="Fechar negócio"
      subtitulo={empresaNome}
      onClose={onClose}
      footer={close => (
        <>
          <button type="button" onClick={close} disabled={salvando}
            className="rounded px-2 py-2 text-[0.75rem] font-medium text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" onClick={() => void fechar(close)} disabled={salvando}
            className="min-h-10 rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:opacity-40">
            {salvando ? "Fechando…" : "Fechar negócio"}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="sm:max-w-[16rem]">
          <label htmlFor={campoValor} className="mb-1.5 block text-[0.6875rem] font-medium text-black/45">Valor fechado</label>
          <CampoValor id={campoValor} value={valorTexto} onChange={texto => { setValorTexto(texto); setErro(null); }} invalido={!lido.valido} autoFocus disabled={Boolean(aceitaId)} />
        </div>
        {erro && <p role="alert" className="rounded border border-[#D94E4E]/25 bg-white px-3 py-2 text-[0.75rem] text-[#B23A3A]">{erro}</p>}
      </div>
    </BottomSheet>
  );
}

type NovoCicloAposRecusa = {
  id: string;
  anoNovo: number;
  retomadaProgramadaEm: string | null;
  onChanged: () => Promise<void> | void;
};

/**
 * Recusa com confirmação, a mesma em qualquer tela. Confirmada a recusa, abre o topsheet
 * de novo ciclo (retomada): quem usa o hook renderiza `novoCicloSheet` na própria tela,
 * que precisa continuar montada durante o `onChanged`.
 */
export function useRecusarNegociacao() {
  const { confirmDelete } = useDeleteConfirm();
  const [novoCiclo, setNovoCiclo] = useState<NovoCicloAposRecusa | null>(null);

  const recusar = useCallback((captacaoId: string, onChanged: () => Promise<void> | void) => {
    confirmDelete({
      title: "Marcar a negociação como recusada?",
      description: "",
      confirmLabel: "Marcar como recusada",
      pendingLabel: "Salvando…",
      illustration: false,
      onConfirm: async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (createClient() as any).from("captacoes").update({ status: "recusado" }).eq("id", captacaoId)
          .select("id, ciclo_ano, created_at, retomada_programada_em").maybeSingle();
        if (error || !data) throw new Error("Não foi possível atualizar a negociação. Tente novamente.");
        await onChanged();
        setNovoCiclo({
          id: data.id,
          anoNovo: (data.ciclo_ano ?? new Date(data.created_at).getFullYear()) + 1,
          retomadaProgramadaEm: data.retomada_programada_em,
          onChanged,
        });
      },
    });
  }, [confirmDelete]);

  const novoCicloSheet = novoCiclo && (
    <RenovarCicloModal
      tipo="captacao"
      id={novoCiclo.id}
      anoNovo={novoCiclo.anoNovo}
      resultadoNegativo
      dataRetomadaInicial={novoCiclo.retomadaProgramadaEm}
      resultadoLabel="Recusado"
      onClose={() => setNovoCiclo(null)}
      onRenovado={() => { setNovoCiclo(null); void novoCiclo.onChanged(); }}
    />
  );

  return { recusar, novoCicloSheet };
}
