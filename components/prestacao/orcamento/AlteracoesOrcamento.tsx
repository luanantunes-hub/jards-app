"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, FileText, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import {
  acoesDaAlteracao,
  acumuladoAprovado,
  calcularAlteracao,
  minutaDoPedido,
  prazoDaAnalise,
  rotuloTipoAlteracao,
  situacaoDaAlteracao,
  type AcaoAlteracao,
  type CalculoAlteracao,
  type ContextoAlteracao,
  type Minuta,
} from "@/lib/prestacao/alteracoes";
import type { NoOrcamento, VersaoOrcamento } from "@/lib/prestacao/orcamento";
import type { RegimeNormativo } from "@/lib/prestacao/regimes";
import { EditorAlteracao, type AlteracaoSalva } from "./EditorAlteracao";
import { DecisaoAlteracao, type AcaoDeDecisao } from "./DecisaoAlteracao";
import { MinutaAlteracao } from "./MinutaAlteracao";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtSinal = (v: number) => (v > 0 ? `+${fmt(v)}` : fmt(v));
const dataBR = (d: string) => d.slice(0, 10).split("-").reverse().join("/");

function hojeEmBrasilia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export type PrestacaoDaAlteracao = {
  titulo: string;
  identificador_oficial: string | null;
  data_liberacao: string | null;
  data_termo?: string | null;
  data_fim_execucao: string | null;
};

const ROTULO_ACAO: Partial<Record<AcaoAlteracao, string>> = {
  editar: "Editar",
  aplicar: "Aplicar",
  solicitar: "Registrar pedido",
  aprovar: "Registrar aprovação",
  negar: "Registrar negativa",
  reabrir: "Voltar para rascunho",
  minuta: "Minuta",
};

/**
 * Alterações do orçamento (P1.7): rascunhos, pedidos ao órgão e o que já foi
 * aplicado. Os rascunhos são recalculados com o orçamento atual, para um
 * valor que mudou desde então aparecer antes de aplicar.
 */
export function AlteracoesOrcamento({ prestacaoId, organizationId, prestacao, regime, versaoAtiva, nosAtivos, permissoes, recarga, onChanged }: {
  prestacaoId: string;
  organizationId: string | null;
  prestacao: PrestacaoDaAlteracao | null;
  regime: RegimeNormativo | null;
  versaoAtiva: VersaoOrcamento | null;
  /** Nós da versão em uso; null quando a tela mostra outra versão. */
  nosAtivos: NoOrcamento[] | null;
  permissoes: { editar: boolean; decidir: boolean };
  recarga: number;
  onChanged: (mensagem?: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { confirmDelete } = useDeleteConfirm();
  const [lidas, setLidas] = useState<{ chave: string; lista: AlteracaoSalva[] } | null>(null);
  const [editor, setEditor] = useState<{ alteracao: AlteracaoSalva | null } | null>(null);
  const [decisao, setDecisao] = useState<{ alteracao: AlteracaoSalva; acao: AcaoDeDecisao } | null>(null);
  const [minuta, setMinuta] = useState<Minuta | null>(null);
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState("");
  const chave = `${prestacaoId}:${recarga}`;

  useEffect(() => {
    let ativo = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacao_alteracoes ainda não está no tipo Database
    (supabase as any)
      .from("prestacao_alteracoes")
      .select("*")
      .eq("prestacao_id", prestacaoId)
      .order("numero", { ascending: false })
      .then(({ data }: { data: AlteracaoSalva[] | null }) => {
        if (ativo) setLidas({ chave, lista: data ?? [] });
      });
    return () => { ativo = false; };
  }, [supabase, prestacaoId, chave]);

  const alteracoes = useMemo(() => (lidas?.chave === chave ? lidas.lista : lidas?.lista ?? []), [lidas, chave]);
  const hoje = hojeEmBrasilia();
  const acumulado = acumuladoAprovado(alteracoes.map(a => ({ status: a.status, tipo: a.tipo, classificacao: a.classificacao, calculo: a.calculo as Partial<CalculoAlteracao> })));
  const contexto: Omit<ContextoAlteracao, "captado"> = {
    hoje,
    dataLiberacao: prestacao?.data_liberacao ?? null,
    dataTermo: prestacao?.data_termo ?? null,
    fimExecucao: prestacao?.data_fim_execucao ?? null,
    movidoAntes: acumulado.movido,
    pedidosAnteriores: acumulado.pedidos,
    homologado: (nosAtivos ?? []).filter(no => no.tipo === "item").reduce((soma, no) => soma + Math.round(no.valor_total * 100), 0) / 100,
    complementadoAntes: acumulado.complementado,
    reduzidoAntes: acumulado.reduzido,
  };
  const podeMontar = Boolean(versaoAtiva && nosAtivos);

  /** Rascunho da versão em uso: recalcula com o orçamento de agora. */
  function calculoAtual(alt: AlteracaoSalva): CalculoAlteracao {
    if (alt.status === "rascunho" && nosAtivos && alt.versao_id === versaoAtiva?.id) {
      return calcularAlteracao(nosAtivos, alt.movimentos, regime, { ...contexto, captado: alt.valor_captado });
    }
    return alt.calculo as unknown as CalculoAlteracao;
  }

  function abrirMinuta(alt: AlteracaoSalva) {
    setMinuta(minutaDoPedido({
      prestacaoTitulo: prestacao?.titulo ?? "Projeto",
      identificador: prestacao?.identificador_oficial
        ? { rotulo: regime?.identificadorOficial?.rotulo ?? "Identificador", valor: prestacao.identificador_oficial }
        : null,
      regime,
      numero: alt.numero,
      data: alt.solicitada_em ?? hoje,
      justificativa: alt.justificativa ?? "",
      movimentos: alt.movimentos,
      calculo: calculoAtual(alt),
    }));
  }

  function excluir(alt: AlteracaoSalva) {
    confirmDelete({
      title: `Excluir o rascunho nº ${alt.numero}?`,
      description: "O rascunho sai da lista. O orçamento não muda.",
      onConfirm: async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- idem
        const { error } = await (supabase as any).from("prestacao_alteracoes").delete().eq("id", alt.id);
        if (error) throw new Error(mensagemErroPrestacao(error, "Não foi possível excluir"));
        onChanged();
      },
    });
  }

  function agir(alt: AlteracaoSalva, acao: AcaoAlteracao) {
    setErro("");
    if (acao === "editar") setEditor({ alteracao: alt });
    else if (acao === "excluir") excluir(alt);
    else if (acao === "minuta") abrirMinuta(alt);
    else setDecisao({ alteracao: alt, acao });
  }

  return (
    <section aria-labelledby="alteracoes-titulo" className="rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <div>
          <h2 id="alteracoes-titulo" className="text-[0.75rem] font-semibold text-[#0D0D0D]">Alterações do orçamento</h2>
          <p className="text-[0.625rem] text-black/40">Remanejamentos, complementações, reduções e itens novos, com o enquadramento do regime</p>
        </div>
        {permissoes.editar && (
          <button
            type="button"
            onClick={() => setEditor({ alteracao: null })}
            disabled={!podeMontar}
            title={podeMontar ? undefined : "Abra a versão em uso para montar uma alteração"}
            className="flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.75rem] text-black/65 transition hover:border-black/25 hover:text-black/85 focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderColor: "rgba(13,13,13,.14)" }}
          >
            <Plus size={13} aria-hidden /> Nova alteração
          </button>
        )}
      </div>

      {erro && <p role="alert" className="px-5 pt-3 text-[0.75rem] text-[#B23B3B]">{erro}</p>}

      {!lidas ? (
        <div className="space-y-2 p-5" aria-busy="true">
          {[0, 1].map(i => <div key={i} className="h-10 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />)}
        </div>
      ) : alteracoes.length === 0 ? (
        <p className="px-5 py-6 text-[0.75rem] leading-5 text-black/45">
          Nenhuma alteração ainda. Quando um item precisar de mais ou menos dinheiro, monte a alteração aqui: o Jards mostra se ela dispensa autorização ou precisa de pedido ao órgão, com a regra e o artigo.
        </p>
      ) : (
        <ul className="divide-y divide-black/[.06]">
          {alteracoes.map(alt => {
            const calculo = calculoAtual(alt);
            const situacao = situacaoDaAlteracao(alt.status, alt.classificacao);
            const acoes = acoesDaAlteracao(alt, permissoes).filter(acao => acao !== "excluir" || alt.status === "rascunho");
            const deOutraVersao = alt.versao_id !== versaoAtiva?.id;
            const bloqueio = alt.status === "rascunho" ? calculo.verificacoes?.find(v => v.nivel === "bloqueio") : undefined;
            const prazo = alt.status === "solicitada" ? prazoDaAnalise(regime, alt.solicitada_em) : null;
            const aberta = abertas.has(alt.id);
            const alternar = () => setAbertas(atual => {
              const proximo = new Set(atual);
              if (proximo.has(alt.id)) proximo.delete(alt.id); else proximo.add(alt.id);
              return proximo;
            });
            return (
              <li key={alt.id} className="px-5 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0 sm:flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={alternar}
                        aria-expanded={aberta}
                        className="flex items-center gap-1 rounded text-[0.8125rem] font-medium text-black/80 focus-visible:outline-2 focus-visible:outline-[#7259B5]"
                      >
                        <ChevronRight size={13} className={`text-black/35 transition-transform duration-200 motion-reduce:transition-none ${aberta ? "rotate-90" : ""}`} aria-hidden />
                        Nº {alt.numero} · {rotuloTipoAlteracao(alt.tipo)}
                      </button>
                      <span className="rounded border bg-white px-2 py-0.5 text-[0.625rem] font-medium" style={{ borderColor: `${situacao.cor}47`, color: situacao.cor }}>
                        {situacao.rotulo}
                      </span>
                      {alt.classificacao && (
                        <span className="text-[0.625rem] text-black/45">{alt.classificacao === "formal" ? "Pedido ao órgão" : "Administrativa"}</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[0.6875rem] text-black/50 tabular-nums">
                      {calculo.itensAlterados ?? alt.movimentos.length} {(calculo.itensAlterados ?? alt.movimentos.length) === 1 ? "item" : "itens"}
                      {calculo.antes && calculo.depois ? ` · total ${fmt(calculo.antes.valorTotalProjeto)} → ${fmt(calculo.depois.valorTotalProjeto)}` : ""}
                      {calculo.diferenca ? ` (${fmtSinal(calculo.diferenca)})` : ""}
                      {calculo.movido ? ` · movido ${fmt(calculo.movido)}` : ""}
                    </p>
                    <p className="mt-0.5 text-[0.6875rem] text-black/45">
                      {alt.status === "rascunho" && `Criado em ${dataBR(alt.created_at)}`}
                      {alt.status === "solicitada" && `Pedido em ${dataBR(alt.solicitada_em ?? alt.created_at)}${alt.protocolo ? ` · ${alt.protocolo}` : ""}`}
                      {alt.status === "solicitada" && prazo && (prazo < hoje
                        ? ` · prazo do órgão venceu em ${dataBR(prazo)}: sem resposta, pode executar`
                        : ` · órgão até ${dataBR(prazo)}`)}
                      {alt.status === "aprovada" && `${alt.classificacao === "administrativa" ? "Aplicada" : "Aprovada"} em ${dataBR(alt.decidida_em ?? alt.aplicada_em ?? alt.created_at)}${alt.ato ? ` · ${alt.ato}` : ""}${alt.aprovacao_tacita ? " · sem resposta do órgão no prazo" : ""}`}
                      {alt.status === "negada" && `Negada em ${dataBR(alt.decidida_em ?? alt.created_at)}${alt.motivo_negativa ? `: ${alt.motivo_negativa}` : ""}`}
                    </p>
                    {bloqueio && <p className="mt-1 text-[0.6875rem] text-[#B23B3B]">Antes de aplicar ou pedir: {bloqueio.texto}</p>}
                    {alt.status === "rascunho" && deOutraVersao && (
                      <p className="mt-1 text-[0.6875rem] text-[#9A6A10]">Montada numa versão que não está mais em uso: refaça na versão atual.</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {acoes.filter(acao => acao !== "excluir").map(acao => {
                      const decideAgora = acao === "aplicar" || acao === "solicitar";
                      const travada = (decideAgora && (Boolean(bloqueio) || deOutraVersao)) || (acao === "editar" && deOutraVersao);
                      const principal = acao === "aplicar" || acao === "solicitar" || acao === "aprovar";
                      return (
                        <button
                          key={acao}
                          type="button"
                          onClick={() => agir(alt, acao)}
                          disabled={travada}
                          title={travada ? "Corrija o rascunho antes" : undefined}
                          className={principal
                            ? "flex h-8 items-center gap-1 rounded bg-[#2E8932] px-3 text-[0.6875rem] font-semibold text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] disabled:cursor-not-allowed disabled:opacity-40"
                            : "flex h-8 items-center gap-1 rounded border bg-white px-2.5 text-[0.6875rem] text-black/60 transition hover:border-black/25 hover:text-black/85 focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:cursor-not-allowed disabled:opacity-40"}
                          style={principal ? undefined : { borderColor: "rgba(13,13,13,.14)" }}
                        >
                          {acao === "minuta" && <FileText size={12} aria-hidden />}
                          {ROTULO_ACAO[acao]}
                        </button>
                      );
                    })}
                    {acoes.includes("excluir") && (
                      <button type="button" onClick={() => excluir(alt)} className="h-8 rounded px-2 text-[0.6875rem] text-[#B23B3B]/80 transition hover:bg-black/[.04] hover:text-[#B23B3B] focus-visible:outline-2 focus-visible:outline-[#D94A4A]">
                        Excluir
                      </button>
                    )}
                  </div>
                </div>

                {aberta && (
                  <div className="mt-3 space-y-2 rounded bg-black/[.02] p-3">
                    {alt.justificativa && <p className="whitespace-pre-line text-[0.6875rem] leading-5 text-black/65">{alt.justificativa}</p>}
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[26rem] text-[0.6875rem]">
                        <tbody>
                          {alt.movimentos.map((m, i) => (
                            <tr key={i} className="border-b last:border-0" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                              <td className="py-1 pr-3 text-black/70">{m.nome}{m.no_id ? "" : " (novo)"}</td>
                              <td className="py-1 text-right tabular-nums text-black/45">{fmt(m.de)}</td>
                              <td className="px-2 py-1 text-center text-black/30">→</td>
                              <td className="py-1 text-right tabular-nums text-black/70">{fmt(m.para)}</td>
                              <td className={`py-1 pl-3 text-right tabular-nums ${m.para - m.de > 0 ? "text-[#2E8932]" : "text-[#B23B3B]"}`}>{fmtSinal(m.para - m.de)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editor && versaoAtiva && nosAtivos && (
        <EditorAlteracao
          alteracao={editor.alteracao}
          versaoId={versaoAtiva.id}
          nos={nosAtivos}
          regime={regime}
          contexto={contexto}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); onChanged("Rascunho da alteração salvo. O orçamento só muda quando ela for aplicada."); }}
        />
      )}
      {decisao && (
        <DecisaoAlteracao
          alteracao={decisao.alteracao}
          acao={decisao.acao}
          regime={regime}
          prestacaoId={prestacaoId}
          organizationId={organizationId}
          onClose={() => setDecisao(null)}
          onDone={mensagem => { setDecisao(null); onChanged(mensagem); }}
        />
      )}
      {minuta && <MinutaAlteracao minuta={minuta} onClose={() => setMinuta(null)} />}
    </section>
  );
}
