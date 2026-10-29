"use client";

// Produção no CMD (P9.5): o que o projeto médico-assistencial lançou no
// Conjunto Mínimo de Dados, por competência e em contagem, ligado à meta.
// Nenhum dado de paciente entra aqui.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { Dropdown } from "@/components/ui/Dropdown";
import { ModalPrestacao } from "@/components/prestacao/ModalPrestacao";
import { competenciaDoTexto, erroDaProducao, resumoDoCmd, rotuloDaCompetencia, type MetaDoCmd } from "@/lib/prestacao/cmd";
import { checarCmd } from "@/lib/prestacao/checagens/checar-cmd";
import type { MetaDoEstado } from "@/lib/prestacao/checagens";
import { numeroDigitado, quantidade } from "@/lib/prestacao/objeto";
import type { RegimeNormativo } from "@/lib/prestacao/regimes";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import { pedirVerificacao } from "@/lib/prestacao/verificar-cliente";
import type { ModalidadeSaude, PrestacaoProducaoCmd } from "@/lib/supabase/types";

const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const CABECALHO = "px-4 py-2.5 text-left text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40";
const ROTULO_DADO = "text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45";
const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";
const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-[#282525] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";
const AREA = "w-full rounded border border-black/[.12] bg-white px-3 py-2 text-[0.75rem] text-[#282525] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";
const numero = (n: number) => n.toLocaleString("pt-BR");

function ProducaoModal({ prestacaoId, producao, metas, onClose, onSaved }: {
  prestacaoId: string;
  producao: PrestacaoProducaoCmd | null;
  metas: readonly MetaDoCmd[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [competencia, setCompetencia] = useState(producao ? rotuloDaCompetencia(producao.competencia) : "");
  const [metaId, setMetaId] = useState(producao?.meta_id ?? (metas.length === 1 ? metas[0].id : ""));
  const [qtd, setQtd] = useState(producao ? String(producao.quantidade) : "");
  const [protocolo, setProtocolo] = useState(producao?.protocolo ?? "");
  const [observacoes, setObservacoes] = useState(producao?.observacoes ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar() {
    const campos = {
      competencia: competenciaDoTexto(competencia),
      meta_id: metaId || null,
      quantidade: numeroDigitado(qtd),
      protocolo: protocolo.trim() || null,
      observacoes: observacoes.trim() || null,
    };
    const problema = erroDaProducao(campos);
    if (problema) { setErro(problema); return; }
    setSalvando(true);
    setErro("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela nova, ainda fora do tipo Database
    const tabela = (supabase as any).from("prestacao_producao_cmd");
    const { error } = producao
      ? await tabela.update(campos).eq("id", producao.id)
      : await tabela.insert({ ...campos, prestacao_id: prestacaoId });
    setSalvando(false);
    if (error) { setErro(mensagemErroPrestacao(error, "Não foi possível salvar a produção")); return; }
    onSaved();
  }

  return (
    <ModalPrestacao
      titulo={producao ? "Editar produção" : "Registrar produção no CMD"}
      subtitulo="A contagem lançada no CMD na competência, sem dado de paciente"
      onClose={onClose}
      largura="max-w-[32rem]"
      rodape={<>
        <span />
        <div className="flex items-center gap-4">
          <button type="button" onClick={onClose} className="rounded px-2 py-2 text-[0.8125rem] text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2 text-[0.8125rem] font-semibold text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {salvando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" aria-hidden />}
            {producao ? "Salvar" : "Registrar produção"}
          </button>
        </div>
      </>}
    >
      <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
        <label>
          <span className={ROTULO}>Competência</span>
          <input value={competencia} onChange={e => setCompetencia(e.target.value)} inputMode="numeric" placeholder="MM/AAAA" maxLength={7} className={CAMPO} autoFocus />
        </label>
        <label>
          <span className={ROTULO}>Quantidade registrada</span>
          <input value={qtd} onChange={e => setQtd(e.target.value)} inputMode="numeric" placeholder="Ex.: 120" className={`${CAMPO} tabular-nums`} />
        </label>
        <label className="sm:col-span-2">
          <span className={ROTULO}>Meta</span>
          <Dropdown value={metaId} onChange={setMetaId} ariaLabel="Meta da produção" options={[{ value: "", label: "Sem meta" }, ...metas.map(m => ({ value: m.id, label: m.descricao }))]} />
        </label>
        <label className="sm:col-span-2">
          <span className={ROTULO}>Lote ou registro no CMD (opcional)</span>
          <input value={protocolo} onChange={e => setProtocolo(e.target.value)} maxLength={120} placeholder="Número do lote ou do registro" className={CAMPO} />
        </label>
        <label className="sm:col-span-2">
          <span className={ROTULO}>Observações (opcional)</span>
          <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} maxLength={1000} placeholder="Sem nome, prontuário ou diagnóstico de paciente" className={AREA} />
        </label>
        {erro && <p role="alert" className="text-[0.75rem] text-[#B23B3B] sm:col-span-2">{erro}</p>}
      </div>
    </ModalPrestacao>
  );
}

export function ProducaoNoCmd({ prestacaoId, regime, modalidade, metas, execucao, podeEditar }: {
  prestacaoId: string;
  regime: RegimeNormativo | null;
  modalidade: ModalidadeSaude | null;
  metas: readonly MetaDoEstado[];
  execucao: { data_inicio_execucao: string | null; data_fim_execucao: string | null };
  podeEditar: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { confirmDelete } = useDeleteConfirm();
  const [lidas, setLidas] = useState<{ linhas: PrestacaoProducaoCmd[]; erro: string } | null>(null);
  const [editando, setEditando] = useState<PrestacaoProducaoCmd | "nova" | null>(null);

  const buscar = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela nova, ainda fora do tipo Database
    const { data, error } = await (supabase as any).from("prestacao_producao_cmd").select("*")
      .eq("prestacao_id", prestacaoId).order("competencia", { ascending: false }).order("created_at");
    return {
      linhas: ((data ?? []) as PrestacaoProducaoCmd[]).map(p => ({ ...p, quantidade: Number(p.quantidade) })),
      erro: error ? mensagemErroPrestacao(error, "Não foi possível carregar a produção no CMD") : "",
    };
  }, [prestacaoId, supabase]);

  useEffect(() => {
    let ativo = true;
    buscar().then(r => { if (ativo) setLidas(r); });
    return () => { ativo = false; };
  }, [buscar]);

  async function recarregar() {
    setLidas(await buscar());
    pedirVerificacao(prestacaoId);
  }

  const linhas = useMemo(() => lidas?.linhas ?? [], [lidas]);
  const resumo = useMemo(() => resumoDoCmd(linhas, metas), [linhas, metas]);
  const achados = useMemo(() => checarCmd({
    regime, despesas: [], fornecedores: [], documentosDosFornecedores: [], itens: [], pagamentos: [], lancamentos: [],
    prestacao: execucao, metas: [...metas], modalidadeSaude: modalidade, producaoCmd: linhas,
  }).filter(a => a.codigo !== "CMD_SEM_PRODUCAO"), [regime, execucao, metas, modalidade, linhas]);
  const metaDe = (id: string | null) => metas.find(m => m.id === id) ?? null;

  function excluir(p: PrestacaoProducaoCmd) {
    confirmDelete({
      title: "Excluir a produção?",
      description: `A produção de ${rotuloDaCompetencia(p.competencia)} (${numero(p.quantidade)}) sai da prestação.`,
      onConfirm: async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela nova, ainda fora do tipo Database
        const { error } = await (supabase as any).from("prestacao_producao_cmd").delete().eq("id", p.id);
        if (error) throw new Error(mensagemErroPrestacao(error, "Não foi possível excluir"));
        await recarregar();
      },
    });
  }

  const botaoIcone = "rounded p-2 text-black/35 transition hover:bg-black/5 hover:text-black/65 focus-visible:outline-2 focus-visible:outline-[#7259B5]";
  const botaoExcluir = "rounded p-2 text-black/25 transition hover:bg-black/[.04] hover:text-[#D94A4A] focus-visible:outline-2 focus-visible:outline-[#D94A4A]";

  return (
    <section className="overflow-hidden rounded border bg-white" style={BORDA} aria-labelledby="cmd-titulo">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <div>
          <h3 id="cmd-titulo" className="text-[0.75rem] font-semibold text-[#282525]">Produção no CMD <span className="font-normal tabular-nums text-black/35">({linhas.length})</span></h3>
          <p className="text-[0.625rem] text-black/40">Lançamentos do Conjunto Mínimo de Dados, por competência.</p>
        </div>
        {podeEditar && (
          <button
            type="button"
            onClick={() => setEditando("nova")}
            className="flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.75rem] text-black/70 transition hover:border-black/25 hover:text-black/90 focus-visible:outline-2 focus-visible:outline-[#7259B5]"
            style={{ borderColor: "rgba(13,13,13,.14)" }}
          >
            <Plus size={13} aria-hidden /> Registrar produção
          </button>
        )}
      </div>

      {lidas?.erro && <p role="alert" className="px-5 py-3 text-[0.75rem] text-[#B23B3B]">{lidas.erro}</p>}

      {!lidas ? (
        <div className="space-y-2 p-5">{[0, 1].map(i => <div key={i} className="h-10 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />)}</div>
      ) : linhas.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <Activity size={20} className="mx-auto text-black/20" aria-hidden />
          <p className="mt-2 text-[0.75rem] text-black/55">Nenhuma produção registrada.</p>
          <p className="mx-auto max-w-[30rem] text-[0.6875rem] text-black/35">
            {podeEditar ? "Registre por mês a quantidade lançada no CMD e a meta. Só a contagem, sem dados de paciente." : "Nenhuma produção registrada."}
          </p>
        </div>
      ) : (
        <>
          <dl className="flex flex-wrap gap-x-6 gap-y-1 border-b px-5 py-3 text-[0.6875rem]" style={{ borderColor: "rgba(13,13,13,.06)" }}>
            <div className="flex items-baseline gap-1.5"><dt className={ROTULO_DADO}>Registrado</dt><dd className="font-semibold tabular-nums text-[#282525]">{numero(resumo.total)}</dd></div>
            <div className="flex items-baseline gap-1.5"><dt className={ROTULO_DADO}>Competências</dt><dd className="font-semibold tabular-nums text-[#282525]">{resumo.competencias.length}</dd></div>
            {resumo.porMeta.map(({ meta, registrado }) => {
              const difere = meta.realizado !== null && meta.realizado !== undefined && Number(meta.realizado) !== registrado;
              return (
                <div key={meta.id} className="flex min-w-0 items-center gap-1.5">
                  <dt className={`${ROTULO_DADO} inline-flex min-w-0 items-center gap-1`}>
                    {difere && <AlertTriangle size={12} strokeWidth={1.75} aria-label="Diferente do realizado da meta" className="shrink-0 text-[#B07A14]" />}
                    <span className="truncate" title={meta.descricao}>{meta.descricao}</span>
                  </dt>
                  <dd className="whitespace-nowrap font-semibold tabular-nums text-[#282525]">
                    {quantidade(registrado, meta.unidade)}
                    {meta.realizado !== null && meta.realizado !== undefined && <span className="font-normal text-black/40"> · realizado {numero(Number(meta.realizado))}</span>}
                  </dd>
                </div>
              );
            })}
          </dl>

          {achados.length > 0 && (
            <ul className="space-y-1.5 border-b px-5 py-3" style={{ borderColor: "rgba(13,13,13,.06)" }} aria-label="Avisos da produção">
              {achados.map(a => (
                <li key={a.chave} className="flex items-start gap-1.5 text-[0.6875rem] text-black/60">
                  <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-[#B07A14]" />
                  <span>{a.mensagem}</span>
                </li>
              ))}
            </ul>
          )}

          <table className="hidden w-full text-[0.75rem] md:table">
            <thead>
              <tr className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                <th className={`${CABECALHO} whitespace-nowrap`}>Competência</th>
                <th className={`${CABECALHO} w-full`}>Meta</th>
                <th className={`${CABECALHO} whitespace-nowrap text-right`}>Quantidade</th>
                <th className={`${CABECALHO} whitespace-nowrap`}>Lote ou registro</th>
                {podeEditar && <th className={CABECALHO}><span className="sr-only">Ações</span></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[.05]">
              {linhas.map(p => {
                const meta = metaDe(p.meta_id);
                return (
                  <tr key={p.id} className="align-top transition hover:bg-black/[.02]">
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-black/75">{rotuloDaCompetencia(p.competencia)}</td>
                    <td className="px-4 py-2.5 text-black/70">
                      {meta ? meta.descricao : <span className="text-black/30">Sem meta</span>}
                      {p.observacoes && <p className="mt-0.5 line-clamp-2 text-[0.6875rem] text-black/45">{p.observacoes}</p>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-[#282525]">{quantidade(p.quantidade, meta?.unidade ?? null)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-[0.6875rem] text-black/55">{p.protocolo ?? <span className="text-black/30">—</span>}</td>
                    {podeEditar && (
                      <td className="whitespace-nowrap px-2 py-1.5 text-right">
                        <button type="button" onClick={() => setEditando(p)} aria-label={`Editar a produção de ${rotuloDaCompetencia(p.competencia)}`} className={botaoIcone}><Pencil size={13} /></button>
                        <button type="button" onClick={() => excluir(p)} aria-label={`Excluir a produção de ${rotuloDaCompetencia(p.competencia)}`} className={botaoExcluir}><Trash2 size={13} /></button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          <ul className="divide-y divide-black/[.05] md:hidden">
            {linhas.map(p => {
              const meta = metaDe(p.meta_id);
              return (
                <li key={p.id} className="flex items-start justify-between gap-2 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-[0.75rem] text-black/80"><span className="tabular-nums">{rotuloDaCompetencia(p.competencia)}</span> · <span className="font-semibold tabular-nums text-[#282525]">{quantidade(p.quantidade, meta?.unidade ?? null)}</span></p>
                    <p className="truncate text-[0.625rem] text-black/45">{[meta?.descricao ?? "Sem meta", p.protocolo].filter(Boolean).join(" · ")}</p>
                  </div>
                  {podeEditar && (
                    <div className="flex shrink-0 items-center">
                      <button type="button" onClick={() => setEditando(p)} aria-label={`Editar a produção de ${rotuloDaCompetencia(p.competencia)}`} className={botaoIcone}><Pencil size={13} /></button>
                      <button type="button" onClick={() => excluir(p)} aria-label={`Excluir a produção de ${rotuloDaCompetencia(p.competencia)}`} className={botaoExcluir}><Trash2 size={13} /></button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {editando && (
        <ProducaoModal
          prestacaoId={prestacaoId}
          producao={editando === "nova" ? null : editando}
          metas={metas}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); void recarregar(); }}
        />
      )}
    </section>
  );
}
