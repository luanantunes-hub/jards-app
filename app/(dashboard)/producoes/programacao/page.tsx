"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, TriangleAlert } from "lucide-react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { papelNaProducao } from "@/lib/producao/permissoes";
import { diaDaSemana, diaEMes } from "@/lib/producao/agenda";
import { somarDias } from "@/lib/producao/tarefas";
import { diasDaSemana, horarioCurto, segundaDaSemana } from "@/lib/producao/turnos";
import {
  faixaDaSessao, lerSessao, pautasQueAceitamSessao, sessoesComSala, sessoesDaSalaNoDia, sessoesEmConflito, type PautaDaSessao, type SessaoComSala, type SessaoDaGrade,
} from "@/lib/producao/programacao";
import { DetailPageContent } from "@/components/ui/DetailPagePrimitives";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";

type Espaco = { id: string; nome: string };
type Sala = { id: string; nome: string };
type Folha = { sessao?: SessaoComSala; salaId: string; dia: string };

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";

function SessaoSheet({ organizationId, folha, pautas, onClose, onSaved }: { organizationId: string; folha: Folha; pautas: PautaDaSessao[]; onClose: () => void; onSaved: () => void }) {
  const { confirmDelete } = useDeleteConfirm();
  const { sessao } = folha;
  const [dia, setDia] = useState(sessao?.dia ?? folha.dia);
  const [pautaId, setPautaId] = useState(sessao?.pauta_id ?? "");
  const [inicio, setInicio] = useState(sessao ? horarioCurto(sessao.inicio) : "");
  const [fim, setFim] = useState(sessao ? horarioCurto(sessao.fim) : "");
  const [titulo, setTitulo] = useState(sessao?.titulo ?? "");
  const [notas, setNotas] = useState(sessao?.notas ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const daSala = useMemo(() => pautasQueAceitamSessao(pautas, folha.salaId, dia), [pautas, folha.salaId, dia]);
  const pautaEscolhida = daSala.some(pauta => pauta.id === pautaId) ? pautaId : (daSala.length === 1 ? daSala[0].id : "");

  async function salvar(fechar: () => void) {
    const leitura = lerSessao({ pautaId: pautaEscolhida, dia, inicio, fim, titulo, notas }, daSala);
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { error } = sessao
      ? await producao.from("producao_sessoes").update(leitura.sessao).eq("id", sessao.id)
      : await producao.from("producao_sessoes").insert({ organization_id: organizationId, ...leitura.sessao });
    setSalvando(false);
    if (error) { setErro(error.code === "42501" ? "Você não pode mudar a programação desta sala." : error.code === "23514" ? "O dia fica fora do período da pauta." : "Não foi possível salvar. Tente de novo."); return; }
    onSaved();
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!sessao) return;
    confirmDelete({
      title: "Apagar sessão?",
      description: `A sessão de ${diaEMes(sessao.dia)}, ${faixaDaSessao(sessao)}, sai da programação. A pauta continua.`,
      confirmLabel: "Apagar", pendingLabel: "Apagando…", illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_sessoes").delete().eq("id", sessao.id);
        if (error) throw new Error("Não foi possível apagar a sessão.");
        onSaved();
        fechar();
      },
    });
  }

  return (
    <TopSheet
      titulo={sessao ? "Editar sessão" : "Nova sessão"}
      onClose={onClose}
      footer={fechar => (
        <>
          {sessao && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className="mr-auto rounded px-4 py-2.5 text-[0.75rem] font-medium text-[#B23B3B] transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className="rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{salvando ? "Salvando…" : sessao ? "Salvar" : "Criar sessão"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div className="grid grid-cols-3 gap-3">
          <div><label className={ROTULO} htmlFor="ses-dia">Dia</label><input id="ses-dia" type="date" className={CAMPO} value={dia} onChange={event => setDia(event.target.value)} disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor="ses-inicio">Começa</label><input id="ses-inicio" type="time" className={CAMPO} value={inicio} onChange={event => setInicio(event.target.value)} disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor="ses-fim">Termina</label><input id="ses-fim" type="time" className={CAMPO} value={fim} onChange={event => setFim(event.target.value)} disabled={salvando} /></div>
        </div>
        {daSala.length === 0 ? (
          <p className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B07A14]" style={{ borderColor: "#B07A1447" }}>Não há pauta nesta sala neste dia. Crie a pauta em Pauta e volte aqui.</p>
        ) : daSala.length > 1 || (sessao && daSala.length === 1) ? (
          <div><span className={ROTULO}>Pauta</span><Dropdown ariaLabel="Pauta da sessão" value={pautaEscolhida} onChange={setPautaId} disabled={salvando || Boolean(sessao)} options={[{ value: "", label: "Escolha a pauta" }, ...daSala.map(pauta => ({ value: pauta.id, label: pauta.titulo }))]} /></div>
        ) : (
          <p className="text-[0.75rem] text-black/55">Pauta: {daSala[0].titulo}</p>
        )}
        <div><label className={ROTULO} htmlFor="ses-titulo">Título da sessão (opcional)</label><input id="ses-titulo" className={CAMPO} value={titulo} onChange={event => setTitulo(event.target.value)} placeholder="Se vazio, vale o título da pauta" maxLength={200} disabled={salvando} /></div>
        <div><label className={ROTULO} htmlFor="ses-notas">Notas (opcional)</label><textarea id="ses-notas" rows={2} className="w-full rounded border border-black/[.12] bg-white px-3 py-2.5 text-[0.8125rem] text-[#282525] outline-none transition focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50" value={notas} onChange={event => setNotas(event.target.value)} maxLength={500} disabled={salvando} /></div>
      </div>
    </TopSheet>
  );
}

/** A grade de programação (PD8.1): salas nas linhas, os dias da semana nas colunas, as sessões com a hora. Horários que se cruzam na mesma sala viram aviso. */
export default function ProgramacaoPage() {
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const hoje = new Date().toISOString().slice(0, 10);
  const [segunda, setSegunda] = useState(() => segundaDaSemana(hoje));
  const [espacos, setEspacos] = useState<Espaco[] | null>(null);
  const [espacoId, setEspacoId] = useState("");
  const [salas, setSalas] = useState<Sala[]>([]);
  const [pautas, setPautas] = useState<PautaDaSessao[]>([]);
  const [sessoesBrutas, setSessoesBrutas] = useState<SessaoDaGrade[]>([]);
  const [folha, setFolha] = useState<Folha | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";
  const dias = useMemo(() => diasDaSemana(segunda), [segunda]);
  const domingo = dias[6];

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const { data, error } = await clienteDaProducao(createClient()).from("producao_espacos").select("id, nome").eq("organization_id", organizationId).eq("arquivado", false).order("nome");
      if (!ativo) return;
      setEspacos((data ?? []) as Espaco[]);
      setEspacoId(atual => atual || data?.[0]?.id || "");
      if (error) setErro("Não foi possível carregar os espaços. Recarregue a página.");
    })();
    return () => { ativo = false; };
  }, [organizationId]);

  useEffect(() => {
    if (!espacoId) return;
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const sal = await producao.from("producao_salas").select("id, nome").eq("espaco_id", espacoId).eq("arquivada", false).order("nome");
      const ids = (sal.data ?? []).map(sala => sala.id);
      const pau = ids.length > 0 ? await producao.from("producao_pautas").select("id, sala_id, titulo, inicio, fim, situacao").in("sala_id", ids).lte("inicio", domingo).gte("fim", segunda) : { data: [], error: null };
      const pautaIds = (pau.data ?? []).map(pauta => pauta.id);
      const ses = pautaIds.length > 0 ? await producao.from("producao_sessoes").select("id, pauta_id, dia, inicio, fim, titulo, notas").in("pauta_id", pautaIds).gte("dia", segunda).lte("dia", domingo) : { data: [], error: null };
      if (!ativo) return;
      setSalas((sal.data ?? []) as Sala[]);
      setPautas((pau.data ?? []) as PautaDaSessao[]);
      setSessoesBrutas((ses.data ?? []) as SessaoDaGrade[]);
      setErro(sal.error || pau.error || ses.error ? "Não foi possível carregar a programação. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [espacoId, segunda, domingo, versao]);

  const sessoes = useMemo(() => sessoesComSala(sessoesBrutas, pautas), [sessoesBrutas, pautas]);
  const conflitos = useMemo(() => sessoesEmConflito(sessoes), [sessoes]);

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-9">
          <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">Programação</h1>
          <p className="mt-1 max-w-2xl text-[0.75rem] text-black/45">As sessões de cada pauta, por sala e por dia, com a hora. A sessão nasce dentro do período de uma pauta e herda a sala dela. Horários que se cruzam na mesma sala viram aviso.</p>
        </div>
      </header>
      <DetailPageContent>
        {erro && <p role="alert" className="mb-4 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {espacos === null ? (
          <div className="h-32 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
        ) : espacos.length === 0 ? (
          <p className="rounded border bg-white px-5 py-8 text-center text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Cadastre um espaço com salas e crie pautas para montar a programação.</p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="w-64 max-w-full"><Dropdown ariaLabel="Espaço" value={espacoId} onChange={setEspacoId} options={espacos.map(espaco => ({ value: espaco.id, label: espaco.nome }))} /></div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setSegunda(atual => somarDias(atual, -7))} aria-label="Semana anterior" className="inline-flex h-10 w-10 items-center justify-center rounded border border-black/[.12] text-black/55 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"><ChevronLeft size={15} aria-hidden="true" /></button>
                <button type="button" onClick={() => setSegunda(segundaDaSemana(hoje))} className="inline-flex h-10 items-center rounded border border-black/[.12] px-3.5 text-[0.75rem] font-medium tabular-nums text-black/60 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]" title="Voltar para a semana de hoje">{diaEMes(segunda)} – {diaEMes(domingo)}</button>
                <button type="button" onClick={() => setSegunda(atual => somarDias(atual, 7))} aria-label="Próxima semana" className="inline-flex h-10 w-10 items-center justify-center rounded border border-black/[.12] text-black/55 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"><ChevronRight size={15} aria-hidden="true" /></button>
              </div>
            </div>

            {conflitos.size > 0 && (
              <p className="mb-3 flex items-center gap-2 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B07A14]" style={{ borderColor: "#B07A1447" }}><TriangleAlert size={13} aria-hidden="true" /> Há sessões que se cruzam na mesma sala (marcadas em âmbar).</p>
            )}

            {salas.length === 0 ? (
              <p className="rounded border bg-white px-5 py-8 text-center text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Este espaço ainda não tem salas.</p>
            ) : (
              <div className="overflow-x-auto rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <table className="w-full min-w-[52rem] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-black/[.06]">
                      <th scope="col" className="w-36 px-4 py-2.5 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Sala</th>
                      {dias.map(dia => <th key={dia} scope="col" className={`px-2 py-2.5 text-[0.625rem] font-medium uppercase tracking-[.08em] ${dia === hoje ? "text-[#282525]" : "text-black/45"}`}>{diaDaSemana(dia)} <span className="tabular-nums">{diaEMes(dia).slice(0, 2)}</span></th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {salas.map(sala => (
                      <tr key={sala.id} className="border-b border-black/[.06] align-top last:border-b-0">
                        <th scope="row" className="px-4 py-2.5 text-left text-[0.8125rem] font-medium text-[#282525]">{sala.nome}</th>
                        {dias.map(dia => {
                          const doDia = sessoesDaSalaNoDia(sessoes, sala.id, dia);
                          const comPauta = pautasQueAceitamSessao(pautas, sala.id, dia).length > 0;
                          return (
                            <td key={dia} className={`px-1.5 py-2 ${dia === hoje ? "bg-black/[.03]" : ""}`}>
                              <div className="space-y-1">
                                {doDia.map(item => (
                                  <button key={item.id} type="button" disabled={!podeEditar} onClick={() => setFolha({ sessao: item, salaId: sala.id, dia })} title={item.notas ?? undefined}
                                    className={`block w-full rounded border px-1.5 py-1 text-left text-[0.6875rem] transition enabled:hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5] ${conflitos.has(item.id) ? "text-[#B07A14]" : "text-[#282525]"}`}
                                    style={{ borderColor: conflitos.has(item.id) ? "#B07A1447" : "rgba(13,13,13,.12)" }}>
                                    <span className="block tabular-nums">{faixaDaSessao(item)}</span>
                                    <span className="block truncate text-[0.625rem] text-black/55">{item.tituloFinal}</span>
                                  </button>
                                ))}
                                {podeEditar && comPauta && <button type="button" aria-label={`Nova sessão em ${sala.nome}, ${diaEMes(dia)}`} onClick={() => setFolha({ salaId: sala.id, dia })} className="flex h-6 w-full items-center justify-center rounded text-black/25 transition hover:bg-black/[.04] hover:text-black/55 focus-visible:outline-2 focus-visible:outline-[#7259B5]"><Plus size={12} aria-hidden="true" /></button>}
                                {!comPauta && doDia.length === 0 && <span className="block text-center text-[0.625rem] text-black/20" aria-label="Sem pauta">·</span>}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-[0.6875rem] text-black/45">O sinal + aparece nos dias em que a sala tem uma pauta (que não esteja cancelada).</p>
          </>
        )}
      </DetailPageContent>
      {folha && organizationId && <SessaoSheet organizationId={organizationId} folha={folha} pautas={pautas} onClose={() => setFolha(null)} onSaved={() => setVersao(atual => atual + 1)} />}
    </div>
  );
}
