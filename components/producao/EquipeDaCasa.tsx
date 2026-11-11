"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, TriangleAlert, UserPlus } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { VincularPessoaSheet } from "@/components/producao/VincularPessoaSheet";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { diaDaSemana, diaEMes } from "@/lib/producao/agenda";
import { somarDias } from "@/lib/producao/tarefas";
import {
  cargasDaSemana, diasDaSemana, formatarDuracao, horarioCurto, LIMITE_SEMANAL_EM_MINUTOS, lerTurno, segundaDaSemana, turnosDaPessoaNoDia, turnosSobrepostos,
  type TurnoDaCasa,
} from "@/lib/producao/turnos";

type VinculoDaCasa = { id: string; pessoa_id: string; funcao: string };
type PautaDaSemana = { id: string; titulo: string; inicio: string; fim: string; situacao: string };
type PessoaOpcao = { id: string; nome: string };

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";
const LIMITE_EM_HORAS = LIMITE_SEMANAL_EM_MINUTOS / 60;

function TurnoSheet({ organizationId, espacoId, pessoas, funcoesPadrao, pautas, turno, pessoaInicial, diaInicial, onClose, onSaved }: {
  organizationId: string; espacoId: string; pessoas: PessoaOpcao[]; funcoesPadrao: ReadonlyMap<string, string>; pautas: PautaDaSemana[];
  turno?: TurnoDaCasa; pessoaInicial?: string; diaInicial: string; onClose: () => void; onSaved: () => void;
}) {
  const { confirmDelete } = useDeleteConfirm();
  const [pessoaId, setPessoaId] = useState(turno?.pessoa_id ?? pessoaInicial ?? "");
  const [dia, setDia] = useState(turno?.dia ?? diaInicial);
  const [inicio, setInicio] = useState(turno ? horarioCurto(turno.inicio) : "");
  const [fim, setFim] = useState(turno ? horarioCurto(turno.fim) : "");
  const [funcao, setFuncao] = useState(turno?.funcao ?? (pessoaInicial ? funcoesPadrao.get(pessoaInicial) ?? "" : ""));
  const [pautaId, setPautaId] = useState(turno?.pauta_id ?? "");
  const [notas, setNotas] = useState(turno?.notas ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const pautasDoDia = useMemo(() => pautas.filter(pauta => pauta.situacao !== "cancelada" && pauta.inicio <= dia && dia <= pauta.fim), [pautas, dia]);

  function escolherPessoa(id: string) {
    setPessoaId(id);
    if (funcao.trim() === "") setFuncao(funcoesPadrao.get(id) ?? "");
  }

  async function salvar(fechar: () => void) {
    const leitura = lerTurno({ pessoaId, dia, inicio, fim, funcao, notas, pautaId: pautasDoDia.some(pauta => pauta.id === pautaId) ? pautaId : "" });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { error } = turno
      ? await producao.from("producao_turnos").update(leitura.turno).eq("id", turno.id)
      : await producao.from("producao_turnos").insert({ organization_id: organizationId, espaco_id: espacoId, ...leitura.turno });
    setSalvando(false);
    if (error) {
      setErro(error.code === "23505" ? "Essa pessoa já tem um turno que começa nessa hora, nesse dia." : error.code === "42501" ? "Você não pode mudar a escala deste espaço." : "Não foi possível salvar. Tente de novo.");
      return;
    }
    onSaved();
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!turno) return;
    confirmDelete({
      title: "Apagar turno?",
      description: `O turno de ${diaEMes(turno.dia)}, ${horarioCurto(turno.inicio)} às ${horarioCurto(turno.fim)}, sai da escala.`,
      confirmLabel: "Apagar",
      pendingLabel: "Apagando…",
      illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_turnos").delete().eq("id", turno.id);
        if (error) throw new Error("Não foi possível apagar o turno.");
        onSaved();
        fechar();
      },
    });
  }

  return (
    <TopSheet
      titulo={turno ? "Editar turno" : "Novo turno"}
      onClose={onClose}
      footer={fechar => (
        <>
          {turno && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className="mr-auto rounded px-4 py-2.5 text-[0.75rem] font-medium text-[#B23B3B] transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className="rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{salvando ? "Salvando…" : turno ? "Salvar" : "Criar turno"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div>
          <span className={ROTULO}>Pessoa</span>
          <Dropdown ariaLabel="Pessoa do turno" value={pessoaId} onChange={escolherPessoa} disabled={salvando || Boolean(turno)} options={[{ value: "", label: "Escolha a pessoa" }, ...pessoas.map(pessoa => ({ value: pessoa.id, label: pessoa.nome }))]} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className={ROTULO} htmlFor="turno-dia">Dia</label><input id="turno-dia" type="date" className={CAMPO} value={dia} onChange={event => setDia(event.target.value)} disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor="turno-inicio">Começa</label><input id="turno-inicio" type="time" className={CAMPO} value={inicio} onChange={event => setInicio(event.target.value)} disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor="turno-fim">Termina</label><input id="turno-fim" type="time" className={CAMPO} value={fim} onChange={event => setFim(event.target.value)} disabled={salvando} /></div>
        </div>
        <div><label className={ROTULO} htmlFor="turno-funcao">Função no turno (opcional)</label><input id="turno-funcao" className={CAMPO} value={funcao} onChange={event => setFuncao(event.target.value)} placeholder="Técnico de som, bilheteria, limpeza" maxLength={80} disabled={salvando} /></div>
        {pautasDoDia.length > 0 && (
          <div>
            <span className={ROTULO}>Evento atendido (opcional)</span>
            <Dropdown ariaLabel="Evento atendido" value={pautasDoDia.some(pauta => pauta.id === pautaId) ? pautaId : ""} onChange={setPautaId} disabled={salvando} options={[{ value: "", label: "Rotina da casa" }, ...pautasDoDia.map(pauta => ({ value: pauta.id, label: pauta.titulo }))]} />
          </div>
        )}
        <div><label className={ROTULO} htmlFor="turno-notas">Notas (opcional)</label><textarea id="turno-notas" rows={2} className="w-full rounded border border-black/[.12] bg-white px-3 py-2.5 text-[0.8125rem] text-[#282525] outline-none transition focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50" value={notas} onChange={event => setNotas(event.target.value)} maxLength={500} disabled={salvando} /></div>
      </div>
    </TopSheet>
  );
}

/**
 * A equipe fixa da casa (PD3.4): quem tem vínculo com o espaço e a escala da semana, de segunda a domingo, com os turnos
 * de cada pessoa, a carga semanal somada e o aviso de passar de 44 horas. Os avisos não travam: a casa decide.
 */
export function EquipeDaCasa({ organizationId, espacoId, podeEditar }: { organizationId: string; espacoId: string; podeEditar: boolean }) {
  const { confirmDelete } = useDeleteConfirm();
  const hoje = new Date().toISOString().slice(0, 10);
  const [segunda, setSegunda] = useState(() => segundaDaSemana(hoje));
  const [vinculos, setVinculos] = useState<VinculoDaCasa[] | null>(null);
  const [pessoas, setPessoas] = useState<PessoaOpcao[]>([]);
  const [turnos, setTurnos] = useState<TurnoDaCasa[]>([]);
  const [pautas, setPautas] = useState<PautaDaSemana[]>([]);
  const [folha, setFolha] = useState<{ tipo: "vinculo" } | { tipo: "turno"; turno?: TurnoDaCasa; pessoaId?: string; dia?: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const recarregar = () => setVersao(atual => atual + 1);
  const dias = useMemo(() => diasDaSemana(segunda), [segunda]);
  const domingo = dias[6];

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [vin, pes, tur, sal] = await Promise.all([
        producao.from("producao_vinculos").select("id, pessoa_id, funcao").eq("espaco_id", espacoId).neq("situacao", "cancelada"),
        producao.from("producao_pessoas").select("id, nome").eq("organization_id", organizationId).eq("arquivada", false).order("nome"),
        producao.from("producao_turnos").select("id, espaco_id, pessoa_id, pauta_id, dia, inicio, fim, funcao, notas").eq("espaco_id", espacoId).gte("dia", segunda).lte("dia", domingo).order("dia").order("inicio"),
        producao.from("producao_salas").select("id").eq("espaco_id", espacoId),
      ]);
      const salaIds = (sal.data ?? []).map(sala => sala.id);
      const pau = salaIds.length > 0
        ? await producao.from("producao_pautas").select("id, titulo, inicio, fim, situacao").in("sala_id", salaIds).lte("inicio", domingo).gte("fim", segunda).order("inicio")
        : { data: [] };
      if (!ativo) return;
      setVinculos((vin.data ?? []) as VinculoDaCasa[]);
      setPessoas((pes.data ?? []) as PessoaOpcao[]);
      setTurnos(((tur.data ?? []) as TurnoDaCasa[]));
      setPautas((pau.data ?? []) as PautaDaSemana[]);
      setErro(vin.error || tur.error ? "Não foi possível carregar a equipe da casa. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [espacoId, organizationId, segunda, domingo, versao]);

  const nomeDe = useMemo(() => new Map(pessoas.map(pessoa => [pessoa.id, pessoa.nome])), [pessoas]);
  const funcoesPadrao = useMemo(() => new Map((vinculos ?? []).map(vinculo => [vinculo.pessoa_id, vinculo.funcao])), [vinculos]);
  const cargas = useMemo(() => new Map(cargasDaSemana(turnos, segunda).map(carga => [carga.pessoaId, carga])), [turnos, segunda]);
  const cruzados = useMemo(() => turnosSobrepostos(turnos), [turnos]);
  // Quem aparece na grade: a equipe fixa e quem tem turno na semana sem ter vínculo (um diarista).
  const linhas = useMemo(() => {
    const ids = new Set([...(vinculos ?? []).map(vinculo => vinculo.pessoa_id), ...turnos.map(turno => turno.pessoa_id)]);
    return [...ids].sort((a, b) => (nomeDe.get(a) ?? "").localeCompare(nomeDe.get(b) ?? "", "pt-BR"));
  }, [vinculos, turnos, nomeDe]);
  const acima = [...cargas.values()].filter(carga => carga.acimaDoLimite);

  function tirarDaEquipe(vinculo: VinculoDaCasa) {
    confirmDelete({
      title: "Tirar da equipe da casa?",
      description: `${nomeDe.get(vinculo.pessoa_id) ?? "A pessoa"} deixa de ser ${vinculo.funcao.toLowerCase()} da casa. Os turnos já lançados continuam na escala.`,
      confirmLabel: "Tirar",
      pendingLabel: "Tirando…",
      illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_vinculos").delete().eq("id", vinculo.id);
        if (error) throw new Error("Não foi possível tirar a pessoa da equipe.");
        recarregar();
      },
    });
  }

  return (
    <section aria-labelledby="equipe-da-casa" className="mt-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="equipe-da-casa" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Equipe da casa</h2>
        {podeEditar && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setFolha({ tipo: "vinculo" })} className="inline-flex h-10 items-center gap-1.5 rounded border border-black/[.12] px-3.5 text-[0.75rem] font-medium text-black/60 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"><UserPlus size={13} aria-hidden="true" /> Pôr pessoa na equipe</button>
            {linhas.length > 0 && <PrimaryListAction onClick={() => setFolha({ tipo: "turno", dia: dias.includes(hoje) ? hoje : dias[0] })}><Plus size={13} aria-hidden="true" /> Novo turno</PrimaryListAction>}
          </div>
        )}
      </div>
      {erro && <p role="alert" className="mb-3 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}

      {vinculos === null ? (
        <div className="h-16 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
      ) : linhas.length === 0 ? (
        <p className="rounded border bg-white px-4 py-5 text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Ponha aqui quem trabalha na casa todo dia: bilheteria, técnica, limpeza. Depois, monte a escala da semana e veja as horas de cada pessoa.</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setSegunda(atual => somarDias(atual, -7))} aria-label="Semana anterior" className="inline-flex h-10 w-10 items-center justify-center rounded border border-black/[.12] text-black/55 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"><ChevronLeft size={15} aria-hidden="true" /></button>
              <button type="button" onClick={() => setSegunda(segundaDaSemana(hoje))} className="inline-flex h-10 items-center rounded border border-black/[.12] px-3.5 text-[0.75rem] font-medium tabular-nums text-black/60 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]" title="Voltar para a semana de hoje">{diaEMes(segunda)} – {diaEMes(domingo)}</button>
              <button type="button" onClick={() => setSegunda(atual => somarDias(atual, 7))} aria-label="Próxima semana" className="inline-flex h-10 w-10 items-center justify-center rounded border border-black/[.12] text-black/55 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"><ChevronRight size={15} aria-hidden="true" /></button>
            </div>
            <p className="text-[0.6875rem] text-black/45">O limite da semana é de {LIMITE_EM_HORAS} horas por pessoa; acima disso a escala avisa.</p>
          </div>

          {(acima.length > 0 || cruzados.size > 0) && (
            <div className="mb-3 space-y-2" aria-label="Avisos da escala">
              {acima.map(carga => <p key={carga.pessoaId} className="flex items-center gap-2 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B07A14]" style={{ borderColor: "#B07A1447" }}><TriangleAlert size={13} aria-hidden="true" /> {nomeDe.get(carga.pessoaId) ?? "A pessoa"} está com {formatarDuracao(carga.minutos)} nesta semana, acima de {LIMITE_EM_HORAS}h.</p>)}
              {cruzados.size > 0 && <p className="flex items-center gap-2 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B07A14]" style={{ borderColor: "#B07A1447" }}><TriangleAlert size={13} aria-hidden="true" /> Há turnos da mesma pessoa que se cruzam no mesmo dia (marcados em âmbar).</p>}
            </div>
          )}

          <div className="overflow-x-auto rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <table className="w-full min-w-[46rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-black/[.06]">
                  <th scope="col" className="w-40 px-4 py-2.5 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Pessoa</th>
                  {dias.map(dia => (
                    <th key={dia} scope="col" className={`px-2 py-2.5 text-[0.625rem] font-medium uppercase tracking-[.08em] ${dia === hoje ? "text-[#282525]" : "text-black/45"}`}>{diaDaSemana(dia)} <span className="tabular-nums">{diaEMes(dia).slice(0, 2)}</span></th>
                  ))}
                  <th scope="col" className="w-20 px-4 py-2.5 text-right text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Semana</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map(pessoaId => {
                  const carga = cargas.get(pessoaId);
                  return (
                    <tr key={pessoaId} className="border-b border-black/[.06] align-top last:border-b-0">
                      <th scope="row" className="px-4 py-2.5 text-left font-normal">
                        <span className="block truncate text-[0.8125rem] font-medium text-[#282525]">{nomeDe.get(pessoaId) ?? "Pessoa"}</span>
                        <span className="block truncate text-[0.6875rem] text-black/45">{funcoesPadrao.get(pessoaId) ?? "Sem vínculo fixo"}</span>
                      </th>
                      {dias.map(dia => (
                        <td key={dia} className={`px-1.5 py-2 ${dia === hoje ? "bg-black/[.03]" : ""}`}>
                          <div className="space-y-1">
                            {turnosDaPessoaNoDia(turnos, pessoaId, dia).map(turno => (
                              <button key={turno.id} type="button" disabled={!podeEditar} onClick={() => setFolha({ tipo: "turno", turno })} title={[turno.funcao, turno.notas].filter(Boolean).join(" · ") || undefined}
                                className={`block w-full rounded border px-1.5 py-1 text-left text-[0.6875rem] tabular-nums transition enabled:hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5] ${cruzados.has(turno.id) ? "text-[#B07A14]" : "text-[#282525]"}`}
                                style={{ borderColor: cruzados.has(turno.id) ? "#B07A1447" : "rgba(13,13,13,.12)" }}>
                                {horarioCurto(turno.inicio)}–{horarioCurto(turno.fim)}
                                {turno.funcao && <span className="block truncate text-[0.625rem] text-black/45">{turno.funcao}</span>}
                              </button>
                            ))}
                            {podeEditar && <button type="button" aria-label={`Novo turno de ${nomeDe.get(pessoaId) ?? "pessoa"} em ${diaEMes(dia)}`} onClick={() => setFolha({ tipo: "turno", pessoaId, dia })} className="flex h-6 w-full items-center justify-center rounded text-black/25 transition hover:bg-black/[.04] hover:text-black/55 focus-visible:outline-2 focus-visible:outline-[#7259B5]"><Plus size={12} aria-hidden="true" /></button>}
                          </div>
                        </td>
                      ))}
                      <td className={`px-4 py-2.5 text-right text-[0.75rem] font-medium tabular-nums ${carga?.acimaDoLimite ? "text-[#B07A14]" : carga ? "text-[#282525]" : "text-black/30"}`}>{formatarDuracao(carga?.minutos ?? 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {(vinculos ?? []).length > 0 && podeEditar && (
            <details className="mt-3">
              <summary className="cursor-pointer text-[0.6875rem] font-medium text-black/50 hover:text-black/70">Quem está na equipe fixa</summary>
              <ul className="mt-2 divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                {(vinculos ?? []).map(vinculo => (
                  <li key={vinculo.id} className="flex items-center gap-3 px-4 py-2">
                    <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-[#282525]">{nomeDe.get(vinculo.pessoa_id) ?? "Pessoa"} <span className="text-black/45">· {vinculo.funcao}</span></span>
                    <button type="button" onClick={() => tirarDaEquipe(vinculo)} className="rounded px-2.5 py-1.5 text-[0.6875rem] font-medium text-black/50 transition hover:bg-black/[.05] hover:text-[#B23B3B] focus-visible:outline-2 focus-visible:outline-[#7259B5]">Tirar</button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {folha?.tipo === "vinculo" && <VincularPessoaSheet organizationId={organizationId} espacoId={espacoId} pessoas={pessoas} jaVinculadas={new Set((vinculos ?? []).map(vinculo => vinculo.pessoa_id))} comDinheiro={false} onClose={() => setFolha(null)} onCreated={recarregar} />}
      {folha?.tipo === "turno" && <TurnoSheet organizationId={organizationId} espacoId={espacoId} pessoas={pessoas} funcoesPadrao={funcoesPadrao} pautas={pautas} turno={folha.turno} pessoaInicial={folha.pessoaId} diaInicial={folha.dia ?? segunda} onClose={() => setFolha(null)} onSaved={recarregar} />}
    </section>
  );
}
