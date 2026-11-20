"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Plus, Trash2, Wand2 } from "lucide-react";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { TopSheet } from "@/components/ui/TopSheet";
import { PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { diaEMes } from "@/lib/producao/agenda";
import type { SituacaoDaTarefa } from "@/lib/producao/estados";
import { grupoDaTarefa, lerTarefa, modelosDeTarefas, modelosQueFaltam, rotuloDoPrazoRelativo } from "@/lib/producao/tarefas";
import type { TipoProducao } from "@/lib/producao/vocabulario";

export type TarefaDaLista = {
  id: string; titulo: string; modelo: string | null; prazo: string | null; prazo_dias: number | null; funcao: string | null; situacao: SituacaoDaTarefa;
};

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";

/** O texto do prazo de uma tarefa: "30 dias antes · 05 nov", só a data quando o prazo é fixo, ou "Sem prazo". */
export function textoDoPrazo(tarefa: Pick<TarefaDaLista, "prazo" | "prazo_dias">): string {
  if (!tarefa.prazo) return "Sem prazo";
  return tarefa.prazo_dias === null ? diaEMes(tarefa.prazo) : `${rotuloDoPrazoRelativo(tarefa.prazo_dias)} · ${diaEMes(tarefa.prazo)}`;
}

function NovaTarefaSheet({ organizationId, dataId, onClose, onCreated }: { organizationId: string; dataId: string; onClose: () => void; onCreated: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [funcao, setFuncao] = useState("");
  const [prazo, setPrazo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const leitura = lerTarefa({ titulo, funcao });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_tarefas")
      .insert({ organization_id: organizationId, data_id: dataId, titulo: leitura.tarefa.titulo, funcao: leitura.tarefa.funcao, prazo: prazo || null });
    setSalvando(false);
    if (error) { setErro(error.code === "42501" ? "Você não pode criar tarefas aqui." : "Não foi possível criar. Tente de novo."); return; }
    onCreated();
    fechar();
  }

  return (
    <TopSheet
      titulo="Nova tarefa"
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className="rounded acao-salvar px-4 py-2.5 text-[0.75rem] font-medium text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{salvando ? "Criando…" : "Criar tarefa"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div>
          <label className={ROTULO} htmlFor="tarefa-titulo">Tarefa</label>
          <input id="tarefa-titulo" autoFocus className={CAMPO} value={titulo} onChange={event => setTitulo(event.target.value)} placeholder="Reservar a van" maxLength={200} disabled={salvando} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={ROTULO} htmlFor="tarefa-prazo">Prazo (opcional)</label>
            <input id="tarefa-prazo" type="date" className={CAMPO} value={prazo} onChange={event => setPrazo(event.target.value)} disabled={salvando} />
          </div>
          <div>
            <label className={ROTULO} htmlFor="tarefa-funcao">Quem (opcional)</label>
            <input id="tarefa-funcao" className={CAMPO} value={funcao} onChange={event => setFuncao(event.target.value)} placeholder="Produção" maxLength={80} disabled={salvando} />
          </div>
        </div>
      </div>
    </TopSheet>
  );
}

/**
 * As tarefas da data (PD1.11): o prazo vem do modelo do tipo de produção, contado da data ("30 dias antes"), e
 * anda junto quando a data muda. "Criar do modelo" põe só as que a data ainda não tem.
 */
export function TarefasDaData({ organizationId, dataId, tipoDeProducao, podeEditar }: { organizationId: string; dataId: string; tipoDeProducao: TipoProducao | null; podeEditar: boolean }) {
  const { confirmDelete } = useDeleteConfirm();
  const [tarefas, setTarefas] = useState<TarefaDaLista[] | null>(null);
  const [folha, setFolha] = useState(false);
  const [trabalhando, setTrabalhando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const recarregar = () => setVersao(atual => atual + 1);
  const hoje = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data, error } = await clienteDaProducao(createClient()).from("producao_tarefas")
        .select("id, titulo, modelo, prazo, prazo_dias, funcao, situacao").eq("data_id", dataId);
      if (!ativo) return;
      setTarefas((data ?? []) as TarefaDaLista[]);
      setErro(error ? "Não foi possível carregar as tarefas. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [dataId, versao]);

  const ordenadas = useMemo(() => [...(tarefas ?? [])].sort((a, b) => (a.situacao === b.situacao ? 0 : a.situacao === "feita" ? 1 : -1) || (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999")), [tarefas]);
  const faltam = useMemo(() => (tipoDeProducao ? modelosQueFaltam(modelosDeTarefas(tipoDeProducao), (tarefas ?? []).map(item => item.modelo)) : []), [tipoDeProducao, tarefas]);

  async function criarDoModelo() {
    setTrabalhando(true);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_tarefas").insert(
      faltam.map(modelo => ({ organization_id: organizationId, data_id: dataId, titulo: modelo.titulo, modelo: modelo.chave, prazo_dias: modelo.dias, funcao: modelo.funcao })),
    );
    setTrabalhando(false);
    if (error) { setErro("Não foi possível criar as tarefas. Tente de novo."); return; }
    recarregar();
  }

  async function alternar(tarefa: TarefaDaLista) {
    const nova: SituacaoDaTarefa = tarefa.situacao === "feita" ? "aberta" : "feita";
    setErro(null);
    setTarefas(atual => atual?.map(item => (item.id === tarefa.id ? { ...item, situacao: nova } : item)) ?? atual);
    const { error } = await clienteDaProducao(createClient()).from("producao_tarefas").update({ situacao: nova }).eq("id", tarefa.id);
    if (error) { recarregar(); setErro("Não foi possível mudar a tarefa. Tente de novo."); }
  }

  function apagar(tarefa: TarefaDaLista) {
    confirmDelete({
      title: "Apagar tarefa?",
      description: `"${tarefa.titulo}" sai desta data.`,
      confirmLabel: "Apagar",
      pendingLabel: "Apagando…",
      illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_tarefas").delete().eq("id", tarefa.id);
        if (error) throw new Error("Não foi possível apagar a tarefa.");
        recarregar();
      },
    });
  }

  const botoes = podeEditar && (
    <div className="flex flex-wrap items-center gap-2">
      {faltam.length > 0 && <PrimaryListAction onClick={() => void criarDoModelo()} disabled={trabalhando}><Wand2 size={13} aria-hidden="true" /> Criar do modelo ({faltam.length})</PrimaryListAction>}
      <PrimaryListAction onClick={() => setFolha(true)}><Plus size={13} aria-hidden="true" /> Nova tarefa</PrimaryListAction>
    </div>
  );

  return (
    <section aria-labelledby="tarefas-da-data" className="mt-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="tarefas-da-data" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Tarefas</h2>
        {ordenadas.length > 0 && botoes}
      </div>
      {erro && <p role="alert" className="mb-3 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
      {tarefas === null ? (
        <div className="h-20 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
      ) : ordenadas.length === 0 ? (
        <div className="rounded border bg-white px-5 py-8 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <p className="text-[0.8125rem] font-medium text-black/55">Nenhuma tarefa nesta data</p>
          <p className="mx-auto mt-1 max-w-sm text-[0.75rem] text-black/45">Crie as do modelo (contrato, rider, hotel, folha do dia…) com o prazo contado da data: se a data mudar, o prazo anda junto.</p>
          {podeEditar && <div className="mt-4 flex justify-center">{botoes}</div>}
        </div>
      ) : (
        <div className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <ul className="divide-y divide-black/[.06]">
            {ordenadas.map(tarefa => {
              const feita = tarefa.situacao === "feita";
              const atrasada = grupoDaTarefa(tarefa, hoje) === "Atrasadas";
              return (
                <li key={tarefa.id} className="flex items-start gap-3 px-4 py-3">
                  <button type="button" disabled={!podeEditar} onClick={() => void alternar(tarefa)} aria-pressed={feita} aria-label={feita ? `Reabrir: ${tarefa.titulo}` : `Concluir: ${tarefa.titulo}`} className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition focus-visible:outline-2 focus-visible:outline-[#7259B5] ${feita ? "border-[#2E8932] bg-[#2E8932] text-white" : "border-black/20 bg-white text-transparent enabled:hover:border-black/40"}`}>
                    <Check size={12} aria-hidden="true" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[0.8125rem] ${feita ? "text-black/40 line-through decoration-black/25" : "font-medium text-[#282525]"}`}>{tarefa.titulo}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[0.6875rem] text-black/45">
                      {atrasada && <AlertTriangle size={12} aria-hidden="true" className="text-[#B07A14]" />}
                      {[textoDoPrazo(tarefa), tarefa.funcao].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {podeEditar && (
                    <button type="button" onClick={() => apagar(tarefa)} aria-label={`Apagar: ${tarefa.titulo}`} title="Apagar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-black/30 transition hover:bg-black/[.05] hover:text-black/60 focus-visible:outline-2 focus-visible:outline-[#7259B5]"><Trash2 size={14} aria-hidden="true" /></button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {folha && <NovaTarefaSheet organizationId={organizationId} dataId={dataId} onClose={() => setFolha(false)} onCreated={recarregar} />}
    </section>
  );
}
