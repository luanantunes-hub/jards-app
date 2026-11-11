"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, TriangleAlert } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { horarioDaEscala } from "@/lib/producao/escala";
import { instanteParaHoraLocal } from "@/lib/producao/dia";
import { somarDias } from "@/lib/producao/agenda";
import { TIPOS_DE_DESLOCAMENTO, type TipoDeDeslocamento } from "@/lib/producao/estados";
import { conflitosDeDeslocamentos, lerDeslocamento, ROTULO_DO_DESLOCAMENTO } from "@/lib/producao/deslocamentos";
import { placaParaExibir } from "@/lib/producao/veiculos";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";

type Deslocamento = {
  id: string; data_id: string; tipo: TipoDeDeslocamento; origem: string | null; destino: string | null; saida: string | null; chegada: string | null;
  veiculo_id: string | null; motorista_id: string | null; companhia: string | null; localizador: string | null; notas: string | null;
};
type Opcao = { id: string; nome: string };

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";
const COLUNAS = "id, data_id, tipo, origem, destino, saida, chegada, veiculo_id, motorista_id, companhia, localizador, notas";

const horaDoCampo = (instante: string | null, fuso: string) => (instante ? instanteParaHoraLocal(instante, fuso).hora : "");

/** "saída 09:00 · chegada 11:00", com "(+1)" quando a chegada é no dia seguinte; vazio sem saída. */
function rotuloDoHorarioDoDeslocamento(saida: string | null, chegada: string | null, fuso: string): string {
  if (!saida) return "";
  const inicio = instanteParaHoraLocal(saida, fuso);
  if (!chegada) return `saída ${inicio.hora}`;
  const fim = instanteParaHoraLocal(chegada, fuso);
  return `saída ${inicio.hora} · chegada ${fim.hora}${fim.dia > inicio.dia ? " (+1)" : ""}`;
}

function DeslocamentoSheet({ organizationId, dataId, dia, fuso, deslocamento, veiculos, pessoas, onClose, onSaved }: {
  organizationId: string; dataId: string; dia: string; fuso: string; deslocamento: Deslocamento | null; veiculos: Opcao[]; pessoas: Opcao[]; onClose: () => void; onSaved: () => void;
}) {
  const { confirmDelete } = useDeleteConfirm();
  const [tipo, setTipo] = useState<string>(deslocamento?.tipo ?? "van");
  const [origem, setOrigem] = useState(deslocamento?.origem ?? "");
  const [destino, setDestino] = useState(deslocamento?.destino ?? "");
  const [saida, setSaida] = useState(horaDoCampo(deslocamento?.saida ?? null, fuso));
  const [chegada, setChegada] = useState(horaDoCampo(deslocamento?.chegada ?? null, fuso));
  const [veiculoId, setVeiculoId] = useState(deslocamento?.veiculo_id ?? "");
  const [motoristaId, setMotoristaId] = useState(deslocamento?.motorista_id ?? "");
  const [companhia, setCompanhia] = useState(deslocamento?.companhia ?? "");
  const [localizador, setLocalizador] = useState(deslocamento?.localizador ?? "");
  const [notas, setNotas] = useState(deslocamento?.notas ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const leitura = lerDeslocamento({ tipo, origem, destino, saida, chegada, veiculoId, motoristaId, companhia, localizador, notas });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const horario = horarioDaEscala(dia, saida, chegada, fuso);
    const valores = { ...leitura.deslocamento, saida: horario.chamada, chegada: horario.saida };
    const producao = clienteDaProducao(createClient());
    const { error } = deslocamento
      ? await producao.from("producao_deslocamentos").update(valores).eq("id", deslocamento.id)
      : await producao.from("producao_deslocamentos").insert({ ...valores, organization_id: organizationId, data_id: dataId });
    setSalvando(false);
    if (error) { setErro(error.code === "42501" ? "Você não pode salvar deslocamentos aqui." : "Não foi possível salvar. Tente de novo."); return; }
    onSaved();
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!deslocamento) return;
    confirmDelete({
      title: "Apagar deslocamento?",
      description: "O deslocamento sai da data.",
      confirmLabel: "Apagar",
      pendingLabel: "Apagando…",
      illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_deslocamentos").delete().eq("id", deslocamento.id);
        if (error) throw new Error("Não foi possível apagar o deslocamento.");
        onSaved();
        fechar();
      },
    });
  }

  return (
    <TopSheet
      titulo={deslocamento ? "Editar deslocamento" : "Novo deslocamento"}
      onClose={onClose}
      footer={fechar => (
        <>
          {deslocamento && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className="mr-auto rounded px-4 py-2.5 text-[0.75rem] font-medium text-[#B23B3B] transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className="rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{salvando ? "Salvando…" : deslocamento ? "Salvar" : "Criar deslocamento"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div>
          <span className={ROTULO}>Tipo</span>
          <Dropdown value={tipo} onChange={setTipo} options={TIPOS_DE_DESLOCAMENTO.map(valor => ({ value: valor, label: ROTULO_DO_DESLOCAMENTO[valor] }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={ROTULO} htmlFor="desloc-origem">De</label>
            <input id="desloc-origem" className={CAMPO} value={origem} onChange={event => setOrigem(event.target.value)} placeholder="São Paulo" maxLength={200} disabled={salvando} />
          </div>
          <div>
            <label className={ROTULO} htmlFor="desloc-destino">Para</label>
            <input id="desloc-destino" className={CAMPO} value={destino} onChange={event => setDestino(event.target.value)} placeholder="Campinas" maxLength={200} disabled={salvando} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={ROTULO} htmlFor="desloc-saida">Saída (opcional)</label>
            <input id="desloc-saida" type="time" className={CAMPO} value={saida} onChange={event => setSaida(event.target.value)} disabled={salvando} />
          </div>
          <div>
            <label className={ROTULO} htmlFor="desloc-chegada">Chegada (opcional)</label>
            <input id="desloc-chegada" type="time" className={CAMPO} value={chegada} onChange={event => setChegada(event.target.value)} disabled={salvando} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={ROTULO}>Veículo</span>
            <Dropdown value={veiculoId} onChange={setVeiculoId} options={[{ value: "", label: "Sem veículo do cadastro" }, ...veiculos.map(item => ({ value: item.id, label: item.nome }))]} />
          </div>
          <div>
            <span className={ROTULO}>Motorista</span>
            <Dropdown value={motoristaId} onChange={setMotoristaId} options={[{ value: "", label: "Sem motorista" }, ...pessoas.map(item => ({ value: item.id, label: item.nome }))]} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={ROTULO} htmlFor="desloc-companhia">Companhia (opcional)</label>
            <input id="desloc-companhia" className={CAMPO} value={companhia} onChange={event => setCompanhia(event.target.value)} placeholder="Azul, Viação Sul…" maxLength={200} disabled={salvando} />
          </div>
          <div>
            <label className={ROTULO} htmlFor="desloc-localizador">Localizador (opcional)</label>
            <input id="desloc-localizador" className={CAMPO} value={localizador} onChange={event => setLocalizador(event.target.value)} maxLength={80} disabled={salvando} />
          </div>
        </div>
        <div>
          <label className={ROTULO} htmlFor="desloc-notas">Notas (opcional)</label>
          <textarea id="desloc-notas" rows={3} className="w-full resize-none rounded border border-black/[.12] bg-white px-3 py-2.5 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50" value={notas} onChange={event => setNotas(event.target.value)} maxLength={2000} disabled={salvando} />
        </div>
        <p className="text-[0.6875rem] text-black/40">A saída e a chegada são na hora do lugar da data. Se a chegada for antes da saída, ela é do dia seguinte.</p>
      </div>
    </TopSheet>
  );
}

/** Os deslocamentos da data (PD6.2): voo, ônibus, van… com veículo e motorista, e o aviso quando o mesmo veículo ou motorista está em dois lugares ao mesmo tempo. */
export function DeslocamentosDaData({ organizationId, data, podeEditar }: {
  organizationId: string;
  data: { id: string; data: string; fuso: string };
  podeEditar: boolean;
}) {
  const [itens, setItens] = useState<Deslocamento[] | null>(null);
  const [vizinhos, setVizinhos] = useState<Deslocamento[]>([]);
  const [veiculos, setVeiculos] = useState<Opcao[]>([]);
  const [veiculosComPlaca, setVeiculosComPlaca] = useState<Map<string, string>>(new Map());
  const [pessoas, setPessoas] = useState<Opcao[]>([]);
  const [folha, setFolha] = useState<{ deslocamento: Deslocamento | null } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const de = `${somarDias(data.data, -2)}T00:00:00Z`, ate = `${somarDias(data.data, 3)}T00:00:00Z`;
      const [proprios, proximos, vei, pes] = await Promise.all([
        producao.from("producao_deslocamentos").select(COLUNAS).eq("data_id", data.id).order("saida", { nullsFirst: false }),
        producao.from("producao_deslocamentos").select(COLUNAS).eq("organization_id", organizationId).gte("saida", de).lte("saida", ate),
        producao.from("producao_veiculos").select("id, nome, placa").eq("organization_id", organizationId).eq("arquivado", false).order("nome"),
        producao.from("producao_pessoas").select("id, nome").eq("organization_id", organizationId).eq("arquivada", false).order("nome"),
      ]);
      if (!ativo) return;
      setItens((proprios.data ?? []) as Deslocamento[]);
      setVizinhos((proximos.data ?? []) as Deslocamento[]);
      setVeiculos((vei.data ?? []).map(item => ({ id: item.id, nome: item.nome })));
      setVeiculosComPlaca(new Map((vei.data ?? []).map(item => [item.id, item.placa ? `${item.nome} (${placaParaExibir(item.placa)})` : item.nome])));
      setPessoas(pes.data ?? []);
      setErro(proprios.error ? "Não foi possível carregar os deslocamentos. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [data.id, data.data, organizationId, versao]);

  const nomes = useMemo(() => ({ veiculos: veiculosComPlaca, pessoas: new Map(pessoas.map(item => [item.id, item.nome])) }), [veiculosComPlaca, pessoas]);
  const avisos = useMemo(() => {
    const todos = new Map<string, Deslocamento>();
    for (const item of [...vizinhos, ...(itens ?? [])]) todos.set(item.id, item);
    return conflitosDeDeslocamentos([...todos.values()], nomes);
  }, [itens, vizinhos, nomes]);

  return (
    <section aria-labelledby="deslocamentos" className="mt-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="deslocamentos" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Deslocamentos</h2>
        {podeEditar && (
          <button type="button" onClick={() => setFolha({ deslocamento: null })} className="flex h-9 items-center gap-1.5 rounded border border-black/12 bg-white px-3.5 text-[0.75rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98]">
            <Plus size={13} aria-hidden="true" /> Novo deslocamento
          </button>
        )}
      </div>
      {erro && <p role="alert" className="mb-3 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
      {itens === null ? (
        <div className="h-16 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
      ) : itens.length === 0 ? (
        <div className="rounded border bg-white px-5 py-6 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <p className="text-[0.8125rem] font-medium text-black/55">Nenhum deslocamento nesta data</p>
          <p className="mx-auto mt-1 max-w-sm text-[0.75rem] text-black/45">Registre o voo, o ônibus ou a van, com a saída, a chegada, o veículo e o motorista.</p>
        </div>
      ) : (
        <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          {itens.map(item => {
            const horario = rotuloDoHorarioDoDeslocamento(item.saida, item.chegada, data.fuso);
            const trecho = [item.origem, item.destino].filter(Boolean).join(" → ");
            const detalhes = [item.veiculo_id ? veiculosComPlaca.get(item.veiculo_id) : null, item.motorista_id ? `motorista ${nomes.pessoas.get(item.motorista_id) ?? ""}`.trim() : null, item.companhia, item.localizador ? `localizador ${item.localizador}` : null].filter(Boolean).join(" · ");
            const conflitos = avisos.get(item.id) ?? [];
            return (
              <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.8125rem] font-medium text-[#282525]">{ROTULO_DO_DESLOCAMENTO[item.tipo]}{trecho ? ` · ${trecho}` : ""}</span>
                  {(horario || detalhes) && <span className="mt-0.5 block text-[0.6875rem] text-black/45">{[horario, detalhes].filter(Boolean).join(" · ")}</span>}
                  {item.notas && <span className="mt-0.5 block text-[0.6875rem] text-black/45">{item.notas}</span>}
                  {conflitos.map(aviso => (
                    <span key={aviso} className="mt-1 flex items-start gap-1.5 text-[0.6875rem]" style={{ color: "#B07A14" }}><TriangleAlert size={12} aria-hidden="true" className="mt-px shrink-0" />{aviso}</span>
                  ))}
                </span>
                {podeEditar && (
                  <button type="button" onClick={() => setFolha({ deslocamento: item })} aria-label="Editar deslocamento" title="Editar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded text-black/35 transition hover:bg-black/[.05] hover:text-black/60 focus-visible:outline-2 focus-visible:outline-[#7259B5]"><Pencil size={13} aria-hidden="true" /></button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {folha && (
        <DeslocamentoSheet organizationId={organizationId} dataId={data.id} dia={data.data} fuso={data.fuso} deslocamento={folha.deslocamento} veiculos={veiculos} pessoas={pessoas}
          onClose={() => setFolha(null)} onSaved={() => setVersao(atual => atual + 1)} />
      )}
    </section>
  );
}
