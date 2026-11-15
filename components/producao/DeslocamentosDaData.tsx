"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Pencil, Plus, TriangleAlert } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { horarioDaEscala } from "@/lib/producao/escala";
import { instanteParaHoraLocal } from "@/lib/producao/dia";
import { somarDias } from "@/lib/producao/agenda";
import { TIPOS_DE_DESLOCAMENTO, type TipoDeDeslocamento } from "@/lib/producao/estados";
import { lerOdometro, textoDaViagem } from "@/lib/producao/viagem-motorista";
import { avisosDeJornada } from "@/lib/producao/jornada";
import { avisoDeLotacao, conflitosDeDeslocamentos, lerDeslocamento, ROTULO_DO_DESLOCAMENTO } from "@/lib/producao/deslocamentos";
import { placaParaExibir } from "@/lib/producao/veiculos";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { ChecklistDoDeslocamento } from "@/components/producao/ChecklistDoDeslocamento";
import type { ContratacaoDoVeiculo } from "@/lib/producao/estados";

type Deslocamento = {
  id: string; data_id: string; tipo: TipoDeDeslocamento; origem: string | null; destino: string | null; saida: string | null; chegada: string | null;
  veiculo_id: string | null; motorista_id: string | null; companhia: string | null; localizador: string | null; notas: string | null;
  odometro_saida_km: number | null; odometro_chegada_km: number | null;
};
type Opcao = { id: string; nome: string };

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";
const COLUNAS = "id, data_id, tipo, origem, destino, saida, chegada, veiculo_id, motorista_id, companhia, localizador, notas, odometro_saida_km, odometro_chegada_km";

const horaDoCampo = (instante: string | null, fuso: string) => (instante ? instanteParaHoraLocal(instante, fuso).hora : "");

/** "saída 09:00 · chegada 11:00", com "(+1)" quando a chegada é no dia seguinte; vazio sem saída. */
function rotuloDoHorarioDoDeslocamento(saida: string | null, chegada: string | null, fuso: string): string {
  if (!saida) return "";
  const inicio = instanteParaHoraLocal(saida, fuso);
  if (!chegada) return `saída ${inicio.hora}`;
  const fim = instanteParaHoraLocal(chegada, fuso);
  return `saída ${inicio.hora} · chegada ${fim.hora}${fim.dia > inicio.dia ? " (+1)" : ""}`;
}

function DeslocamentoSheet({ organizationId, dataId, dia, fuso, deslocamento, veiculos, pessoas, quemVai, onClose, onSaved }: {
  organizationId: string; dataId: string; dia: string; fuso: string; deslocamento: Deslocamento | null; veiculos: Opcao[]; pessoas: Opcao[]; quemVai: string[]; onClose: () => void; onSaved: () => void;
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
  const [odometroSaida, setOdometroSaida] = useState(deslocamento?.odometro_saida_km?.toString() ?? "");
  const [odometroChegada, setOdometroChegada] = useState(deslocamento?.odometro_chegada_km?.toString() ?? "");
  const [vao, setVao] = useState<string[]>(quemVai);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const leitura = lerDeslocamento({ tipo, origem, destino, saida, chegada, veiculoId, motoristaId, companhia, localizador, notas });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const horario = horarioDaEscala(dia, saida, chegada, fuso);
    const km = { saida: lerOdometro(odometroSaida), chegada: lerOdometro(odometroChegada) };
    if (km.saida === "invalido" || km.chegada === "invalido") { setSalvando(false); setErro("O odômetro é um número inteiro de quilômetros."); return; }
    if (km.saida !== null && km.chegada !== null && km.chegada < km.saida) { setSalvando(false); setErro("O odômetro da chegada não pode ser menor que o da saída."); return; }
    const valores = { ...leitura.deslocamento, saida: horario.chamada, chegada: horario.saida, odometro_saida_km: km.saida, odometro_chegada_km: km.chegada };
    const producao = clienteDaProducao(createClient());
    let id = deslocamento?.id ?? "";
    if (deslocamento) {
      const { error } = await producao.from("producao_deslocamentos").update(valores).eq("id", deslocamento.id);
      if (error) { setSalvando(false); setErro(error.code === "42501" ? "Você não pode salvar deslocamentos aqui." : "Não foi possível salvar. Tente de novo."); return; }
    } else {
      const { data, error } = await producao.from("producao_deslocamentos").insert({ ...valores, organization_id: organizationId, data_id: dataId }).select("id").single();
      if (error || !data) { setSalvando(false); setErro(error?.code === "42501" ? "Você não pode salvar deslocamentos aqui." : "Não foi possível salvar. Tente de novo."); return; }
      id = data.id;
    }
    const entram = vao.filter(pessoa => !quemVai.includes(pessoa));
    const saem = quemVai.filter(pessoa => !vao.includes(pessoa));
    if (entram.length > 0) {
      const { error } = await producao.from("producao_deslocamento_pessoas").insert(entram.map(pessoa => ({ organization_id: organizationId, deslocamento_id: id, pessoa_id: pessoa })));
      if (error) { setSalvando(false); setErro("O deslocamento foi salvo, mas não foi possível pôr as pessoas nele. Abra o deslocamento para tentar de novo."); onSaved(); return; }
    }
    if (saem.length > 0) {
      const { error } = await producao.from("producao_deslocamento_pessoas").delete().eq("deslocamento_id", id).in("pessoa_id", saem);
      if (error) { setSalvando(false); setErro("O deslocamento foi salvo, mas não foi possível tirar as pessoas dele. Abra o deslocamento para tentar de novo."); onSaved(); return; }
    }
    setSalvando(false);
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
        {pessoas.length > 0 && (
          <fieldset>
            <legend className={ROTULO}>Quem vai (opcional)</legend>
            <div className="max-h-48 space-y-0.5 overflow-y-auto rounded border p-1" style={{ borderColor: "rgba(13,13,13,.12)" }}>
              {pessoas.map(pessoa => (
                <label key={pessoa.id} className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded px-2.5 text-[0.8125rem] text-[#282525] hover:bg-black/[.04]">
                  <input type="checkbox" checked={vao.includes(pessoa.id)} disabled={salvando} onChange={event => setVao(atual => (event.target.checked ? [...atual, pessoa.id] : atual.filter(id => id !== pessoa.id)))} className="h-4 w-4 accent-[#282525]" />
                  {pessoa.nome}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {deslocamento && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={ROTULO} htmlFor="desloc-odo-saida">Odômetro na saída (km)</label>
              <input id="desloc-odo-saida" inputMode="numeric" className={CAMPO} value={odometroSaida} onChange={event => setOdometroSaida(event.target.value)} disabled={salvando} />
            </div>
            <div>
              <label className={ROTULO} htmlFor="desloc-odo-chegada">Odômetro na chegada (km)</label>
              <input id="desloc-odo-chegada" inputMode="numeric" className={CAMPO} value={odometroChegada} onChange={event => setOdometroChegada(event.target.value)} disabled={salvando} />
            </div>
          </div>
        )}
        <div>
          <label className={ROTULO} htmlFor="desloc-notas">Notas (opcional)</label>
          <textarea id="desloc-notas" rows={3} className="w-full resize-none rounded border border-black/[.12] bg-white px-3 py-2.5 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50" value={notas} onChange={event => setNotas(event.target.value)} maxLength={2000} disabled={salvando} />
        </div>
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
  const [lugaresDoVeiculo, setLugaresDoVeiculo] = useState<Map<string, number | null>>(new Map());
  const [capacidadeDoVeiculo, setCapacidadeDoVeiculo] = useState<Map<string, { capacidade_carga_kg: number | null; capacidade_volume_m3: number | null; contratacao: ContratacaoDoVeiculo }>>(new Map());
  const [checklist, setChecklist] = useState<Deslocamento | null>(null);
  const [litrosPorDeslocamento, setLitrosPorDeslocamento] = useState<Map<string, number>>(new Map());
  const [quemVaiPorDeslocamento, setQuemVaiPorDeslocamento] = useState<Map<string, string[]>>(new Map());
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
        producao.from("producao_veiculos").select("id, nome, placa, lugares, capacidade_carga_kg, capacidade_volume_m3, contratacao").eq("organization_id", organizationId).eq("arquivado", false).order("nome"),
        producao.from("producao_pessoas").select("id, nome").eq("organization_id", organizationId).eq("arquivada", false).order("nome"),
      ]);
      if (!ativo) return;
      setItens((proprios.data ?? []) as Deslocamento[]);
      setVizinhos((proximos.data ?? []) as Deslocamento[]);
      setVeiculos((vei.data ?? []).map(item => ({ id: item.id, nome: item.nome })));
      setVeiculosComPlaca(new Map((vei.data ?? []).map(item => [item.id, item.placa ? `${item.nome} (${placaParaExibir(item.placa)})` : item.nome])));
      setLugaresDoVeiculo(new Map((vei.data ?? []).map(item => [item.id, item.lugares])));
      setCapacidadeDoVeiculo(new Map((vei.data ?? []).map(item => [item.id, { capacidade_carga_kg: item.capacidade_carga_kg, capacidade_volume_m3: item.capacidade_volume_m3, contratacao: item.contratacao }])));
      const ids = [...new Set([...(proprios.data ?? []), ...(proximos.data ?? [])].map(item => item.id))];
      const quemVai = new Map<string, string[]>();
      if (ids.length > 0) {
        const { data: ligacoes } = await producao.from("producao_deslocamento_pessoas").select("deslocamento_id, pessoa_id").in("deslocamento_id", ids);
        for (const ligacao of ligacoes ?? []) quemVai.set(ligacao.deslocamento_id, [...(quemVai.get(ligacao.deslocamento_id) ?? []), ligacao.pessoa_id]);
      }
      if (!ativo) return;
      setQuemVaiPorDeslocamento(quemVai);
      const proprias = (proprios.data ?? []).map(item => item.id);
      const litros = new Map<string, number>();
      if (proprias.length > 0) {
        const { data: abastecimentos } = await producao.from("producao_abastecimentos").select("deslocamento_id, litros").in("deslocamento_id", proprias);
        for (const linha of abastecimentos ?? []) litros.set(linha.deslocamento_id, (litros.get(linha.deslocamento_id) ?? 0) + Number(linha.litros));
      }
      if (!ativo) return;
      setLitrosPorDeslocamento(litros);
      setPessoas(pes.data ?? []);
      setErro(proprios.error ? "Não foi possível carregar os deslocamentos. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [data.id, data.data, organizationId, versao]);

  const nomes = useMemo(() => ({ veiculos: veiculosComPlaca, pessoas: new Map(pessoas.map(item => [item.id, item.nome])) }), [veiculosComPlaca, pessoas]);
  const avisos = useMemo(() => {
    const todos = new Map<string, Deslocamento>();
    for (const item of [...vizinhos, ...(itens ?? [])]) todos.set(item.id, item);
    const lista = [...todos.values()];
    const resultado = conflitosDeDeslocamentos(lista.map(item => ({ ...item, pessoas_ids: quemVaiPorDeslocamento.get(item.id) ?? [] })), nomes);
    // A jornada do motorista (PD6.5): mais de 5h30 de direção sem pausa de 30 minutos, olhando também os deslocamentos dos dias vizinhos.
    for (const [id, textos] of avisosDeJornada(lista, nomes.pessoas)) resultado.set(id, [...(resultado.get(id) ?? []), ...textos]);
    return resultado;
  }, [itens, vizinhos, nomes, quemVaiPorDeslocamento]);

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
            const vao = quemVaiPorDeslocamento.get(item.id) ?? [];
            const nomesDeQuemVai = vao.map(pessoa => nomes.pessoas.get(pessoa) ?? "Pessoa").sort((a, b) => a.localeCompare(b, "pt-BR"));
            const lotacao = item.veiculo_id ? avisoDeLotacao(lugaresDoVeiculo.get(item.veiculo_id) ?? null, vao.length) : null;
            const conflitos = [...(avisos.get(item.id) ?? []), ...(lotacao ? [lotacao] : [])];
            return (
              <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.8125rem] font-medium text-[#282525]">{ROTULO_DO_DESLOCAMENTO[item.tipo]}{trecho ? ` · ${trecho}` : ""}</span>
                  {(horario || detalhes) && <span className="mt-0.5 block text-[0.6875rem] text-black/45">{[horario, detalhes].filter(Boolean).join(" · ")}</span>}
                  {textoDaViagem({ odometro_saida_km: item.odometro_saida_km, odometro_chegada_km: item.odometro_chegada_km, litros: litrosPorDeslocamento.get(item.id) ?? 0 }) && (
                    <span className="mt-0.5 block text-[0.6875rem] text-black/45">{textoDaViagem({ odometro_saida_km: item.odometro_saida_km, odometro_chegada_km: item.odometro_chegada_km, litros: litrosPorDeslocamento.get(item.id) ?? 0 })}</span>
                  )}
                  {nomesDeQuemVai.length > 0 && <span className="mt-0.5 block text-[0.6875rem] text-black/45">Vão: {nomesDeQuemVai.join(", ")}</span>}
                  {item.notas && <span className="mt-0.5 block text-[0.6875rem] text-black/45">{item.notas}</span>}
                  {conflitos.map(aviso => (
                    <span key={aviso} className="mt-1 flex items-start gap-1.5 text-[0.6875rem]" style={{ color: "#B07A14" }}><TriangleAlert size={12} aria-hidden="true" className="mt-px shrink-0" />{aviso}</span>
                  ))}
                </span>
                <button type="button" onClick={() => setChecklist(item)} aria-label="Checklist do deslocamento" title="Checklist" className="flex h-10 w-10 shrink-0 items-center justify-center rounded text-black/35 transition hover:bg-black/[.05] hover:text-black/60 focus-visible:outline-2 focus-visible:outline-[#7259B5]"><ClipboardCheck size={14} aria-hidden="true" /></button>
                {podeEditar && (
                  <button type="button" onClick={() => setFolha({ deslocamento: item })} aria-label="Editar deslocamento" title="Editar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded text-black/35 transition hover:bg-black/[.05] hover:text-black/60 focus-visible:outline-2 focus-visible:outline-[#7259B5]"><Pencil size={13} aria-hidden="true" /></button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {checklist && (
        <ChecklistDoDeslocamento organizationId={organizationId} deslocamento={{ id: checklist.id, data_id: data.id, tipo: checklist.tipo, rotulo: [ROTULO_DO_DESLOCAMENTO[checklist.tipo], [checklist.origem, checklist.destino].filter(Boolean).join(" → ")].filter(Boolean).join(" ") }}
          veiculo={checklist.veiculo_id ? capacidadeDoVeiculo.get(checklist.veiculo_id) ?? null : null} podeEditar={podeEditar} onClose={() => setChecklist(null)} onMudou={() => undefined} />
      )}
      {folha && (
        <DeslocamentoSheet organizationId={organizationId} dataId={data.id} dia={data.data} fuso={data.fuso} deslocamento={folha.deslocamento} veiculos={veiculos} pessoas={pessoas} quemVai={folha.deslocamento ? quemVaiPorDeslocamento.get(folha.deslocamento.id) ?? [] : []}
          onClose={() => setFolha(null)} onSaved={() => setVersao(atual => atual + 1)} />
      )}
    </section>
  );
}
