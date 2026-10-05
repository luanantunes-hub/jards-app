"use client";

import { useId, useMemo, useState } from "react";
import { Plus, Search, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import {
  calcularAlteracao,
  rotuloTipoAlteracao,
  type ClassificacaoAlteracao,
  type ContextoAlteracao,
  type MovimentoAlteracao,
} from "@/lib/prestacao/alteracoes";
import {
  gruposDoRegime,
  itensDaArvore,
  lerValor,
  montarArvore,
  paisPossiveis,
  rotuloGrupo,
  type GrupoCusto,
  type NoOrcamento,
} from "@/lib/prestacao/orcamento";
import type { RegimeNormativo } from "@/lib/prestacao/regimes";
import { VerificacoesAlteracao } from "./VerificacoesAlteracao";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtSinal = (v: number) => (v > 0 ? `+${fmt(v)}` : fmt(v));
const CAMPO = "w-full rounded border border-black/[.12] px-2.5 py-1.5 text-[0.75rem] outline-none transition focus:border-[#7259B5] focus-visible:ring-2 focus-visible:ring-[#7259B5]/20";
const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";

export type AlteracaoSalva = {
  id: string;
  versao_id: string;
  numero: number;
  tipo: string;
  classificacao: ClassificacaoAlteracao | null;
  status: "rascunho" | "solicitada" | "aprovada" | "negada";
  justificativa: string | null;
  movimentos: MovimentoAlteracao[];
  calculo: Record<string, unknown>;
  valor_captado: number | null;
  solicitada_em: string | null;
  protocolo: string | null;
  decidida_em: string | null;
  ato: string | null;
  documento_path: string | null;
  motivo_negativa: string | null;
  aprovacao_tacita: boolean;
  aplicada_em: string | null;
  created_at: string;
};

type ItemNovo = { chave: number; nome: string; parent_id: string; grupo_custo: string; valor: string };

function texto(valor: number): string {
  return String(valor).replace(".", ",");
}

/**
 * Monta ou edita o rascunho de uma alteração: novo valor por item, itens
 * novos e justificativa, com o cálculo do regime ao lado (tipo, classificação
 * e verificações com a fonte). Salvar só grava o rascunho.
 */
export function EditorAlteracao({ alteracao, versaoId, nos, regime, contexto, onClose, onSaved }: {
  alteracao: AlteracaoSalva | null;
  versaoId: string;
  nos: NoOrcamento[];
  regime: RegimeNormativo | null;
  contexto: Omit<ContextoAlteracao, "captado">;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const titleId = useId();
  useModalDismiss(onClose);

  const arvore = useMemo(() => montarArvore(nos, []), [nos]);
  const itens = useMemo(() => itensDaArvore(arvore.raizes), [arvore]);
  const agrupadores = useMemo(() => paisPossiveis(arvore.raizes, null), [arvore]);

  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries((alteracao?.movimentos ?? []).filter(m => m.no_id).map(m => [m.no_id as string, texto(m.para)])));
  const [novos, setNovos] = useState<ItemNovo[]>(() =>
    (alteracao?.movimentos ?? []).filter(m => !m.no_id).map((m, i) => ({
      chave: i, nome: m.nome, parent_id: m.parent_id ?? "", grupo_custo: m.grupo_custo ?? "", valor: texto(m.para),
    })));
  const [justificativa, setJustificativa] = useState(alteracao?.justificativa ?? "");
  const [captado, setCaptado] = useState(alteracao?.valor_captado != null ? texto(alteracao.valor_captado) : "");
  const [classificacaoManual, setClassificacaoManual] = useState<ClassificacaoAlteracao | "">(alteracao?.classificacao ?? "");
  const [filtro, setFiltro] = useState("");
  const [soAlterados, setSoAlterados] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const movimentos: MovimentoAlteracao[] = [
    ...itens.flatMap(linha => {
      const digitado = valores[linha.no.id];
      if (digitado === undefined || digitado.trim() === "") return [];
      const para = lerValor(digitado);
      if (Math.round(para * 100) === Math.round(linha.totais.vigente * 100)) return [];
      return [{ no_id: linha.no.id, nome: linha.no.nome, parent_id: null, grupo_custo: null, de: linha.totais.vigente, para }];
    }),
    ...novos
      .filter(n => n.nome.trim() || lerValor(n.valor) > 0)
      .map(n => ({
        no_id: null, nome: n.nome.trim(), parent_id: n.parent_id || null,
        grupo_custo: (n.grupo_custo || null) as GrupoCusto | null, de: 0, para: lerValor(n.valor),
      })),
  ];
  const valorCaptado = captado.trim() === "" ? null : lerValor(captado);
  const calculo = calcularAlteracao(nos, movimentos, regime, { ...contexto, captado: valorCaptado });
  const classificacao = calculo.classificacao ?? (classificacaoManual || null);
  const alterados = new Set(movimentos.filter(m => m.no_id).map(m => m.no_id as string));

  const busca = filtro.trim().toLowerCase();
  const linhasVisiveis = itens.filter(linha =>
    (!soAlterados || alterados.has(linha.no.id)) &&
    (!busca || `${linha.caminho.join(" ")} ${linha.no.nome}`.toLowerCase().includes(busca)));

  async function salvar() {
    if (movimentos.length === 0) { setErro("Mude o valor de ao menos um item ou inclua um item novo."); return; }
    setSalvando(true);
    setErro("");
    const dados = {
      tipo: calculo.tipo,
      classificacao,
      justificativa: justificativa.trim() || null,
      movimentos,
      calculo,
      valor_captado: valorCaptado,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacao_alteracoes ainda não está no tipo Database
    const tabela = (supabase as any).from("prestacao_alteracoes");
    const { error } = alteracao
      ? await tabela.update(dados).eq("id", alteracao.id)
      : await tabela.insert({ ...dados, versao_id: versaoId });
    setSalvando(false);
    if (error) { setErro(mensagemErroPrestacao(error, "Não foi possível salvar a alteração")); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-[96dvh] w-full max-w-[72rem] flex-col overflow-hidden rounded bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div>
            <h2 id={titleId} className="text-[0.875rem] font-semibold text-[#0D0D0D]">
              {alteracao ? `Alteração nº ${alteracao.numero}` : "Nova alteração do orçamento"}
            </h2>
            <p className="text-[0.6875rem] text-black/40">Digite o novo valor vigente só dos itens que mudam. Nada muda no orçamento até a alteração ser aplicada.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded p-1.5 text-black/35 transition hover:bg-black/5 hover:text-black/55 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
            <X size={15} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_22rem] lg:overflow-hidden">
          {/* Itens */}
          <div className="min-w-0 lg:overflow-y-auto">
            <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-white px-5 py-3" style={{ borderColor: "rgba(13,13,13,.06)" }}>
              <label className="relative min-w-[12rem] flex-1">
                <span className="sr-only">Filtrar itens</span>
                <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-black/30" aria-hidden />
                <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Filtrar itens" className={`${CAMPO} pl-8`} />
              </label>
              <label className="flex items-center gap-1.5 text-[0.6875rem] text-black/55">
                <input type="checkbox" checked={soAlterados} onChange={e => setSoAlterados(e.target.checked)} className="accent-[#7259B5]" />
                Só os alterados ({alterados.size})
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem]">
                <thead>
                  <tr className="border-b bg-[#F9F9F8]" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                    {["Item", "Vigente", "Novo valor", "Diferença"].map((titulo, i) => (
                      <th key={titulo} scope="col" className={`px-3 py-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/35 ${i === 0 ? "text-left" : "text-right"}`}>{titulo}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhasVisiveis.map(linha => {
                    const mov = movimentos.find(m => m.no_id === linha.no.id);
                    const diferenca = mov ? mov.para - mov.de : 0;
                    return (
                      <tr key={linha.no.id} className={`border-b ${mov ? "bg-[#7259B5]/[.035]" : ""}`} style={{ borderColor: "rgba(13,13,13,.05)" }}>
                        <td className="px-3 py-2">
                          {linha.caminho.length > 0 && <p className="text-[0.5625rem] uppercase tracking-[.08em] text-black/30">{linha.caminho.join(" › ")}</p>}
                          <p className="text-[0.75rem] text-black/80">{linha.no.nome}</p>
                          <p className="text-[0.625rem] text-black/35">{linha.grupo ? rotuloGrupo(linha.grupo, regime) : "Sem grupo de custo"}</p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-[0.75rem] tabular-nums text-black/55">{fmt(linha.totais.vigente)}</td>
                        <td className="w-[9.5rem] px-3 py-2">
                          <input
                            inputMode="decimal"
                            aria-label={`Novo valor de ${linha.no.nome}`}
                            value={valores[linha.no.id] ?? ""}
                            placeholder="Sem mudança"
                            onChange={e => setValores({ ...valores, [linha.no.id]: e.target.value })}
                            className={`${CAMPO} text-right tabular-nums`}
                          />
                        </td>
                        <td className={`whitespace-nowrap px-3 py-2 text-right text-[0.75rem] tabular-nums ${diferenca > 0 ? "text-[#2E8932]" : diferenca < 0 ? "text-[#B23B3B]" : "text-black/25"}`}>
                          {diferenca ? fmtSinal(diferenca) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {linhasVisiveis.length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-6 text-center text-[0.75rem] text-black/40">Nenhum item com esse filtro.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Itens novos */}
            <div className="space-y-2 px-5 py-4">
              {novos.map(novo => (
                <div key={novo.chave} className="grid grid-cols-1 gap-2 rounded border p-3 sm:grid-cols-[1fr_11rem_11rem_8.5rem_auto] sm:items-end" style={{ borderColor: "rgba(13,13,13,.1)" }}>
                  <label className="block">
                    <span className={ROTULO}>Item novo</span>
                    <input value={novo.nome} onChange={e => setNovos(novos.map(n => n.chave === novo.chave ? { ...n, nome: e.target.value } : n))} className={CAMPO} placeholder="Nome do item" />
                  </label>
                  <div>
                    <span className={ROTULO}>Dentro de</span>
                    <Dropdown
                      value={novo.parent_id}
                      onChange={valor => setNovos(novos.map(n => n.chave === novo.chave ? { ...n, parent_id: valor } : n))}
                      ariaLabel="Agrupador do item novo"
                      options={[{ value: "", label: "Na raiz" }, ...agrupadores.map(l => ({ value: l.no.id, label: `${"· ".repeat(l.nivel)}${l.no.nome}` }))]}
                    />
                  </div>
                  <div>
                    <span className={ROTULO}>Grupo de custo</span>
                    <Dropdown
                      value={novo.grupo_custo}
                      onChange={valor => setNovos(novos.map(n => n.chave === novo.chave ? { ...n, grupo_custo: valor } : n))}
                      ariaLabel="Grupo de custo do item novo"
                      options={[{ value: "", label: "Do agrupador" }, ...gruposDoRegime(regime).map(g => ({ value: g.id, label: g.rotulo }))]}
                    />
                  </div>
                  <label className="block">
                    <span className={ROTULO}>Valor</span>
                    <input inputMode="decimal" value={novo.valor} onChange={e => setNovos(novos.map(n => n.chave === novo.chave ? { ...n, valor: e.target.value } : n))} className={`${CAMPO} text-right tabular-nums`} placeholder="R$ 0,00" />
                  </label>
                  <button type="button" onClick={() => setNovos(novos.filter(n => n.chave !== novo.chave))} aria-label="Tirar o item novo" className="h-9 rounded px-2 text-black/30 transition hover:bg-[#D94A4A]/10 hover:text-[#D94A4A] focus-visible:outline-2 focus-visible:outline-[#D94A4A]">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setNovos([...novos, { chave: Date.now(), nome: "", parent_id: "", grupo_custo: "", valor: "" }])}
                className="flex items-center gap-1.5 rounded px-2 py-1.5 text-[0.75rem] text-[#684DB0] transition hover:bg-[#7259B5]/[.06] focus-visible:outline-2 focus-visible:outline-[#7259B5]"
              >
                <Plus size={13} aria-hidden /> Incluir item novo
              </button>
            </div>
          </div>

          {/* Cálculo */}
          <aside className="space-y-4 border-t bg-[#FAFAF9] px-5 py-4 lg:overflow-y-auto lg:border-l lg:border-t-0" style={{ borderColor: "rgba(13,13,13,.07)" }} aria-label="Cálculo da alteração">
            <div>
              <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/35">Tipo</p>
              <p className="text-[0.875rem] font-semibold text-[#0D0D0D]">{movimentos.length ? rotuloTipoAlteracao(calculo.tipo) : "—"}</p>
              {calculo.classificacao ? (
                <p className={`mt-0.5 text-[0.75rem] ${calculo.classificacao === "formal" ? "text-[#9A6A10]" : "text-[#2E8932]"}`}>
                  {calculo.classificacao === "formal" ? "Precisa de pedido ao órgão" : "Administrativa: aplica sem pedido"}
                </p>
              ) : movimentos.length > 0 && (
                <fieldset className="mt-2">
                  <legend className={ROTULO}>Como esta alteração se enquadra?</legend>
                  <div className="grid grid-cols-2 gap-2" role="radiogroup">
                    {([["administrativa", "Administrativa"], ["formal", "Pedido ao órgão"]] as const).map(([valor, rotulo]) => (
                      <button
                        key={valor}
                        type="button"
                        role="radio"
                        aria-checked={classificacaoManual === valor}
                        onClick={() => setClassificacaoManual(valor)}
                        className={`rounded border px-2 py-1.5 text-[0.6875rem] transition focus-visible:outline-2 focus-visible:outline-[#7259B5] ${classificacaoManual === valor ? "border-[#7259B5] bg-[#7259B5]/[.05] text-[#684DB0]" : "border-black/[.12] text-black/60 hover:border-black/25"}`}
                      >
                        {rotulo}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
            </div>

            {movimentos.length > 0 && (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[0.6875rem]">
                <dt className="text-black/45">Valor total</dt>
                <dd className="text-right tabular-nums text-black/75">{fmt(calculo.antes.valorTotalProjeto)} → {fmt(calculo.depois.valorTotalProjeto)}</dd>
                {calculo.antes.valorProjeto !== calculo.antes.valorTotalProjeto && (
                  <>
                    <dt className="text-black/45">Valor do projeto</dt>
                    <dd className="text-right tabular-nums text-black/75">{fmt(calculo.antes.valorProjeto)} → {fmt(calculo.depois.valorProjeto)}</dd>
                  </>
                )}
                <dt className="text-black/45">Diferença</dt>
                <dd className={`text-right tabular-nums ${calculo.diferenca > 0 ? "text-[#2E8932]" : calculo.diferenca < 0 ? "text-[#B23B3B]" : "text-black/60"}`}>{calculo.diferenca ? fmtSinal(calculo.diferenca) : "Sem mudança"}</dd>
                <dt className="text-black/45">Movido entre itens</dt>
                <dd className="text-right tabular-nums text-black/75">{fmt(calculo.movido)}</dd>
              </dl>
            )}

            {calculo.tipo === "complementacao" && movimentos.length > 0 && (
              <label className="block">
                <span className={ROTULO}>Valor captado até agora</span>
                <input inputMode="decimal" value={captado} onChange={e => setCaptado(e.target.value)} className={`${CAMPO} tabular-nums`} placeholder="R$ 0,00" />
              </label>
            )}

            <VerificacoesAlteracao verificacoes={calculo.verificacoes} />

            <label className="block">
              <span className={ROTULO}>Justificativa *</span>
              <textarea
                value={justificativa}
                onChange={e => setJustificativa(e.target.value)}
                rows={4}
                className={`${CAMPO} resize-y`}
                placeholder="Por que a mudança é necessária e como ela preserva o objeto"
              />
              <span className="mt-1 block text-[0.625rem] leading-4 text-black/40">Obrigatória para aplicar ou pedir; entra na minuta e no relatório.</span>
            </label>
          </aside>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-5 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <p role={erro ? "alert" : undefined} className={`text-[0.6875rem] ${erro ? "text-[#B23B3B]" : "text-black/40"}`}>
            {erro || (calculo.bloqueado && movimentos.length ? "Pode salvar o rascunho, mas corrija o que impede antes de aplicar ou pedir." : `${movimentos.length} ${movimentos.length === 1 ? "item muda" : "itens mudam"}.`)}
          </p>
          <div className="flex items-center gap-4">
            <button type="button" onClick={onClose} className="rounded px-2 py-2 text-[0.8125rem] text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Cancelar</button>
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2 text-[0.8125rem] font-semibold text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {salvando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />}
              Salvar rascunho
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
