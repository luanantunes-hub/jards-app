"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Plus, TriangleAlert, Wrench } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { CATEGORIAS_DO_ITEM, ESTADOS_DO_EQUIPAMENTO, TIPOS_DE_MANUTENCAO, type CategoriaDoItem, type EstadoDoEquipamento } from "@/lib/producao/estados";
import { lerEquipamento, lerManutencao, pendenciasDaCasa, proximaPreventiva, ROTULO_DO_ESTADO, ROTULO_DO_TIPO_DE_MANUTENCAO } from "@/lib/producao/equipamentos";
import { ROTULO_DA_CATEGORIA } from "@/lib/producao/inventario";
import { diaEMes } from "@/lib/producao/agenda";

export type EquipamentoDaCasa = { id: string; nome: string; categoria: CategoriaDoItem; quantidade: number; estado: EstadoDoEquipamento; sala_id: string | null; observacoes: string | null };
type Manutencao = { id: string; equipamento_id: string; tipo: "preventiva" | "corretiva"; descricao: string; prevista_para: string; feita_em: string | null; recorrencia_dias: number | null };

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";

function Rodape({ fechar, salvando, rotulo, onSalvar, extra }: { fechar: () => void; salvando: boolean; rotulo: string; onSalvar: () => void; extra?: React.ReactNode }) {
  return (
    <>
      {extra}
      <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
      <button type="button" onClick={onSalvar} disabled={salvando} className="rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{salvando ? "Salvando…" : rotulo}</button>
    </>
  );
}

function EquipamentoSheet({ organizationId, espacoId, salas, equipamento, onClose, onSaved }: {
  organizationId: string; espacoId: string; salas: { id: string; nome: string }[]; equipamento?: EquipamentoDaCasa; onClose: () => void; onSaved: () => void;
}) {
  const { confirmDelete } = useDeleteConfirm();
  const [nome, setNome] = useState(equipamento?.nome ?? "");
  const [categoria, setCategoria] = useState<string>(equipamento?.categoria ?? "luz");
  const [quantidade, setQuantidade] = useState(String(equipamento?.quantidade ?? 1));
  const [estado, setEstado] = useState<string>(equipamento?.estado ?? "em_uso");
  const [salaId, setSalaId] = useState(equipamento?.sala_id ?? "");
  const [observacoes, setObservacoes] = useState(equipamento?.observacoes ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const leitura = lerEquipamento({ nome, categoria, quantidade, estado, salaId, observacoes });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { error } = equipamento
      ? await producao.from("producao_equipamentos").update(leitura.equipamento).eq("id", equipamento.id)
      : await producao.from("producao_equipamentos").insert({ organization_id: organizationId, espaco_id: espacoId, ...leitura.equipamento });
    setSalvando(false);
    if (error) { setErro(error.code === "42501" ? "Você não pode mudar os equipamentos deste espaço." : "Não foi possível salvar. Tente de novo."); return; }
    onSaved();
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!equipamento) return;
    confirmDelete({
      title: "Apagar equipamento?",
      description: `"${equipamento.nome}" e as manutenções dele saem do espaço. Para só tirar da ficha, mude o estado para Baixado.`,
      confirmLabel: "Apagar",
      pendingLabel: "Apagando…",
      illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_equipamentos").delete().eq("id", equipamento.id);
        if (error) throw new Error("Não foi possível apagar o equipamento.");
        onSaved();
        fechar();
      },
    });
  }

  return (
    <TopSheet
      titulo={equipamento ? "Editar equipamento" : "Novo equipamento"}
      onClose={onClose}
      footer={fechar => <Rodape fechar={fechar} salvando={salvando} rotulo={equipamento ? "Salvar" : "Cadastrar"} onSalvar={() => void salvar(fechar)}
        extra={equipamento ? <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className="mr-auto rounded px-4 py-2.5 text-[0.75rem] font-medium text-[#B23B3B] transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Apagar</button> : undefined} />}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <div><label className={ROTULO} htmlFor="eq-nome">Equipamento</label><input id="eq-nome" autoFocus className={CAMPO} value={nome} onChange={event => setNome(event.target.value)} placeholder="Refletor LED 200 W" maxLength={200} disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor="eq-qtd">Quantidade</label><input id="eq-qtd" inputMode="numeric" className={CAMPO} value={quantidade} onChange={event => setQuantidade(event.target.value)} disabled={salvando} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><span className={ROTULO}>Categoria</span><Dropdown value={categoria} onChange={setCategoria} options={CATEGORIAS_DO_ITEM.map(valor => ({ value: valor, label: ROTULO_DA_CATEGORIA[valor] }))} /></div>
          <div><span className={ROTULO}>Estado</span><Dropdown value={estado} onChange={setEstado} options={ESTADOS_DO_EQUIPAMENTO.map(valor => ({ value: valor, label: ROTULO_DO_ESTADO[valor] }))} /></div>
        </div>
        {salas.length > 0 && <div><span className={ROTULO}>Sala (opcional)</span><Dropdown value={salaId} onChange={setSalaId} options={[{ value: "", label: "O espaço todo" }, ...salas.map(sala => ({ value: sala.id, label: sala.nome }))]} /></div>}
        <div><label className={ROTULO} htmlFor="eq-obs">Observações</label><textarea id="eq-obs" rows={3} className="w-full rounded border border-black/[.12] bg-white px-3 py-2.5 text-[0.8125rem] text-[#282525] outline-none transition focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50" value={observacoes} onChange={event => setObservacoes(event.target.value)} maxLength={2000} disabled={salvando} /></div>
      </div>
    </TopSheet>
  );
}

function ManutencaoSheet({ organizationId, equipamentos, equipamentoInicial, onClose, onSaved }: {
  organizationId: string; equipamentos: EquipamentoDaCasa[]; equipamentoInicial: string; onClose: () => void; onSaved: () => void;
}) {
  const [equipamentoId, setEquipamentoId] = useState(equipamentoInicial || equipamentos[0]?.id || "");
  const [tipo, setTipo] = useState<string>("preventiva");
  const [descricao, setDescricao] = useState("");
  const [prevista, setPrevista] = useState("");
  const [recorrencia, setRecorrencia] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    if (!equipamentoId) { setErro("Escolha o equipamento."); return; }
    const leitura = lerManutencao({ tipo, descricao, prevista, recorrencia });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_manutencoes").insert({ organization_id: organizationId, equipamento_id: equipamentoId, ...leitura.manutencao });
    setSalvando(false);
    if (error) { setErro(error.code === "42501" ? "Você não pode agendar manutenção aqui." : "Não foi possível agendar. Tente de novo."); return; }
    onSaved();
    fechar();
  }

  return (
    <TopSheet titulo="Agendar manutenção" onClose={onClose} footer={fechar => <Rodape fechar={fechar} salvando={salvando} rotulo="Agendar" onSalvar={() => void salvar(fechar)} />}>
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div><span className={ROTULO}>Equipamento</span><Dropdown value={equipamentoId} onChange={setEquipamentoId} options={equipamentos.map(item => ({ value: item.id, label: item.nome }))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><span className={ROTULO}>Tipo</span><Dropdown value={tipo} onChange={valor => { setTipo(valor); if (valor !== "preventiva") setRecorrencia(""); }} options={TIPOS_DE_MANUTENCAO.map(valor => ({ value: valor, label: ROTULO_DO_TIPO_DE_MANUTENCAO[valor] }))} /></div>
          <div><label className={ROTULO} htmlFor="man-data">Prevista para</label><input id="man-data" type="date" className={CAMPO} value={prevista} onChange={event => setPrevista(event.target.value)} disabled={salvando} /></div>
        </div>
        <div><label className={ROTULO} htmlFor="man-desc">O que fazer</label><input id="man-desc" autoFocus className={CAMPO} value={descricao} onChange={event => setDescricao(event.target.value)} placeholder="Limpeza e revisão" maxLength={500} disabled={salvando} /></div>
        {tipo === "preventiva" && <div><label className={ROTULO} htmlFor="man-rec">Repetir a cada (dias, opcional)</label><input id="man-rec" inputMode="numeric" className={CAMPO} value={recorrencia} onChange={event => setRecorrencia(event.target.value)} placeholder="90" disabled={salvando} /></div>}
      </div>
    </TopSheet>
  );
}

/** Os equipamentos da casa e a manutenção (PD3.2): o que está em uso entra na ficha; o avariado vira pendência. */
export function EquipamentosDoEspaco({ organizationId, espacoId, salas, podeEditar, onChange }: {
  organizationId: string; espacoId: string; salas: { id: string; nome: string }[]; podeEditar: boolean; onChange?: (equipamentos: EquipamentoDaCasa[]) => void;
}) {
  const [equipamentos, setEquipamentos] = useState<EquipamentoDaCasa[] | null>(null);
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([]);
  const [folha, setFolha] = useState<{ tipo: "equipamento"; equipamento?: EquipamentoDaCasa } | { tipo: "manutencao"; equipamentoId: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const recarregar = () => setVersao(atual => atual + 1);
  const hoje = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const { data: eq, error } = await producao.from("producao_equipamentos").select("id, nome, categoria, quantidade, estado, sala_id, observacoes").eq("espaco_id", espacoId).order("nome");
      const ids = (eq ?? []).map(item => item.id);
      const man = ids.length > 0 ? await producao.from("producao_manutencoes").select("id, equipamento_id, tipo, descricao, prevista_para, feita_em, recorrencia_dias").in("equipamento_id", ids).order("prevista_para") : { data: [] };
      if (!ativo) return;
      setEquipamentos((eq ?? []) as EquipamentoDaCasa[]);
      setManutencoes((man.data ?? []) as Manutencao[]);
      setErro(error ? "Não foi possível carregar os equipamentos. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [espacoId, versao]);

  useEffect(() => { if (equipamentos) onChange?.(equipamentos); }, [equipamentos]); // eslint-disable-line react-hooks/exhaustive-deps

  const pendencias = useMemo(() => pendenciasDaCasa(equipamentos ?? [], manutencoes, hoje), [equipamentos, manutencoes, hoje]);
  const abertas = manutencoes.filter(item => item.feita_em === null);
  const nomeDo = (id: string) => equipamentos?.find(item => item.id === id)?.nome ?? "";

  async function feita(manutencao: Manutencao) {
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { error } = await producao.from("producao_manutencoes").update({ feita_em: hoje }).eq("id", manutencao.id);
    if (error) { setErro("Não foi possível marcar como feita. Tente de novo."); return; }
    const proxima = manutencao.tipo === "preventiva" ? proximaPreventiva(hoje, manutencao.recorrencia_dias) : null;
    if (proxima) {
      const { error: erroDaProxima } = await producao.from("producao_manutencoes").insert({ organization_id: organizationId, equipamento_id: manutencao.equipamento_id, tipo: "preventiva", descricao: manutencao.descricao, prevista_para: proxima, recorrencia_dias: manutencao.recorrencia_dias });
      if (erroDaProxima) setErro("Foi marcada como feita, mas a próxima não foi agendada. Agende à mão.");
    }
    recarregar();
  }

  return (
    <section aria-labelledby="equipamentos-da-casa" className="mt-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="equipamentos-da-casa" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Equipamentos da casa</h2>
        {podeEditar && (
          <div className="flex flex-wrap items-center gap-2">
            {(equipamentos?.length ?? 0) > 0 && <button type="button" onClick={() => setFolha({ tipo: "manutencao", equipamentoId: "" })} className="inline-flex h-10 items-center gap-1.5 rounded border border-black/[.12] px-3.5 text-[0.75rem] font-medium text-black/60 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"><Wrench size={13} aria-hidden="true" /> Agendar manutenção</button>}
            <PrimaryListAction onClick={() => setFolha({ tipo: "equipamento" })}><Plus size={13} aria-hidden="true" /> Novo equipamento</PrimaryListAction>
          </div>
        )}
      </div>
      {erro && <p role="alert" className="mb-3 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}

      {(pendencias.avariados.length > 0 || pendencias.vencidas.length > 0) && (
        <div className="mb-4 space-y-2" aria-label="Pendências da casa">
          {pendencias.avariados.map(item => <p key={item.id} className="flex items-center gap-2 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B07A14]" style={{ borderColor: "#B07A1447" }}><TriangleAlert size={13} aria-hidden="true" /> {item.nome} está avariado e ficou fora da ficha.</p>)}
          {pendencias.vencidas.map(item => <p key={item.id} className="flex items-center gap-2 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B07A14]" style={{ borderColor: "#B07A1447" }}><TriangleAlert size={13} aria-hidden="true" /> Manutenção vencida: {item.equipamento}, {item.descricao} (era para {diaEMes(item.prevista_para)}).</p>)}
        </div>
      )}

      {equipamentos === null ? (
        <div className="h-16 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
      ) : equipamentos.length === 0 ? (
        <p className="rounded border bg-white px-4 py-5 text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Cadastre o que a casa tem: refletores, mesa de som, projetor. O que estiver em uso entra na ficha; o avariado sai dela.</p>
      ) : (
        <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          {equipamentos.map(item => (
            <li key={item.id}>
              <button type="button" disabled={!podeEditar} onClick={() => setFolha({ tipo: "equipamento", equipamento: item })} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-left transition enabled:hover:bg-black/[.02] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                <span className="min-w-0 flex-1 basis-48">
                  <span className="block truncate text-[0.8125rem] font-medium text-[#282525]">{item.nome}</span>
                  <span className="block truncate text-[0.6875rem] text-black/45">{[ROTULO_DA_CATEGORIA[item.categoria], item.sala_id ? salas.find(sala => sala.id === item.sala_id)?.nome : null].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="w-12 text-right text-[0.75rem] tabular-nums text-black/55">{item.quantidade.toLocaleString("pt-BR")} un.</span>
                <span className={`w-28 text-right text-[0.6875rem] font-medium ${item.estado === "avariado" ? "text-[#B07A14]" : "text-black/50"}`}>{ROTULO_DO_ESTADO[item.estado]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {abertas.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Manutenções a fazer</p>
          <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            {abertas.map(item => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] text-[#282525]">{nomeDo(item.equipamento_id)} · {item.descricao}</p>
                  <p className="text-[0.6875rem] text-black/45">{ROTULO_DO_TIPO_DE_MANUTENCAO[item.tipo]} · {item.prevista_para < hoje ? "venceu em" : "para"} {diaEMes(item.prevista_para)}{item.recorrencia_dias ? ` · repete a cada ${item.recorrencia_dias} dias` : ""}</p>
                </div>
                {podeEditar && <button type="button" onClick={() => void feita(item)} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded border border-black/[.12] px-3 text-[0.75rem] font-medium text-black/60 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"><Check size={13} aria-hidden="true" /> Feita</button>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {folha?.tipo === "equipamento" && <EquipamentoSheet organizationId={organizationId} espacoId={espacoId} salas={salas} equipamento={folha.equipamento} onClose={() => setFolha(null)} onSaved={recarregar} />}
      {folha?.tipo === "manutencao" && equipamentos && <ManutencaoSheet organizationId={organizationId} equipamentos={equipamentos.filter(item => item.estado !== "baixado")} equipamentoInicial={folha.equipamentoId} onClose={() => setFolha(null)} onSaved={recarregar} />}
    </section>
  );
}
