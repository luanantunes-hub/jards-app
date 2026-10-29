"use client";

// Ações do assistente (Claude e ChatGPT), na visão geral: o que ele registrou, enviou ou verificou nesta prestação, com a
// opção de retirar o que criou enquanto a equipe ainda não avaliou. O card só aparece quando há alguma ação.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { COLUNAS_DA_ACAO, podeRetirar, ROTULO_DO_ASSISTENTE, type LinhaDaAcao } from "@/lib/mcp/prestacao/acoes-do-assistente";

const LINK = "rounded text-[0.6875rem] text-black/45 underline decoration-black/20 underline-offset-2 transition focus-visible:outline-2 focus-visible:outline-[#7259B5]";
const VISIVEIS = 5;
const BUSCADAS = 30;

/** Quem fez: a retirada feita pela equipe, pelo app, não é do assistente (a trilha guarda as duas no mesmo lugar). */
const quemFez = (a: Pick<LinhaDaAcao, "ferramenta" | "plataforma">) => (a.ferramenta === "retirada_pela_equipe" ? "Equipe" : (ROTULO_DO_ASSISTENTE[a.plataforma] ?? ROTULO_DO_ASSISTENTE.outro));

const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function AcoesDoAssistente({ prestacaoId, podeEditar }: { prestacaoId: string; podeEditar: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const { confirmDelete } = useDeleteConfirm();
  const [acoes, setAcoes] = useState<LinhaDaAcao[]>([]);
  const [total, setTotal] = useState(0);
  const [todas, setTodas] = useState(false);

  const buscar = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela nova, ainda fora do tipo Database
    const { data, error, count } = await (supabase as any)
      .from("assistente_acoes")
      .select(COLUNAS_DA_ACAO, { count: "exact" })
      .eq("prestacao_id", prestacaoId)
      .order("created_at", { ascending: false })
      .limit(BUSCADAS);
    // Sem a tabela (ou sem permissão para ler), o card simplesmente não aparece.
    if (error) return { acoes: [] as LinhaDaAcao[], total: 0 };
    return { acoes: (data ?? []) as LinhaDaAcao[], total: (count ?? data?.length ?? 0) as number };
  }, [prestacaoId, supabase]);

  useEffect(() => {
    let ativo = true;
    buscar().then(r => {
      if (!ativo) return;
      setAcoes(r.acoes);
      setTotal(r.total);
    });
    return () => { ativo = false; };
  }, [buscar]);

  if (acoes.length === 0) return null;
  const mostradas = todas ? acoes : acoes.slice(0, VISIVEIS);

  function retirar(acao: LinhaDaAcao) {
    const despesa = acao.tabela === "prestacao_comprovantes";
    confirmDelete({
      title: `Retirar ${despesa ? "a despesa" : "a evidência"} do assistente?`,
      description: `${despesa ? "A despesa sai da prestação" : "A evidência sai da prestação"} e o arquivo é apagado. Só dá enquanto ninguém avaliou nem enviou ao órgão.`,
      confirmLabel: "Retirar",
      onConfirm: async () => {
        const resposta = await fetch(`/api/prestacoes/${prestacaoId}/assistente/retirar`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ acao_id: acao.id }),
        }).catch(() => null);
        if (!resposta) throw new Error("Sem conexão. Confira a internet e tente de novo.");
        if (!resposta.ok) {
          const corpo = (await resposta.json().catch(() => ({}))) as { error?: string };
          throw new Error(corpo.error ?? "Não foi possível retirar agora.");
        }
        const r = await buscar();
        setAcoes(r.acoes);
        setTotal(r.total);
      },
    });
  }

  return (
    <div className="rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold text-black/50"><Bot size={13} aria-hidden /> Ações do assistente</p>
        {total > VISIVEIS && <span className="text-[0.625rem] tabular-nums text-black/35">{total}</span>}
      </div>
      <ul className="divide-y px-4 text-[0.6875rem]" style={{ borderColor: "rgba(13,13,13,.06)" }} aria-label="Ações do assistente">
        {mostradas.map(a => (
          <li key={a.id} className="flex items-start gap-3 py-2.5 leading-snug" style={{ borderColor: "rgba(13,13,13,.06)" }}>
            <div className="min-w-0 flex-1">
              <p className={a.desfeita_em ? "text-black/40 line-through" : "text-black/75"}>{a.resumo}</p>
              <p className="text-black/45">
                {quemFez(a)} · {quando(a.created_at)}
                {a.desfeita_em && " · retirada"}
              </p>
            </div>
            {podeEditar && podeRetirar(a) && (
              <button type="button" onClick={() => retirar(a)} className={`${LINK} shrink-0 hover:text-[#B23B3B]`}>Retirar</button>
            )}
          </li>
        ))}
      </ul>
      {acoes.length > VISIVEIS && (
        <div className="border-t px-4 py-2.5" style={{ borderColor: "rgba(13,13,13,.06)" }}>
          <button type="button" onClick={() => setTodas(v => !v)} className={`${LINK} hover:text-black/75`}>{todas ? "Ver menos" : `Ver mais ${acoes.length - VISIVEIS}`}</button>
        </div>
      )}
    </div>
  );
}
