"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { papelNaProducao } from "@/lib/producao/permissoes";
import { diaDaSemana, diaEMes } from "@/lib/producao/agenda";
import { diasDaJanela, filaDePreReservas, ocupacaoDoAno, pautasEmConflito, pautasNoDia, preReservasVencendo, ROTULO_DA_SITUACAO_DA_PAUTA, type PautaDaGrade } from "@/lib/producao/pauta";
import { somarDias } from "@/lib/producao/tarefas";
import { rotuloDoLugar } from "@/lib/producao/espacos";
import { DetailPageContent } from "@/components/ui/DetailPagePrimitives";
import { PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { PautaSheet, type SalaDaPauta } from "@/components/producao/PautaSheet";

const DIAS_NA_JANELA = 14;
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

type Folha = { pauta?: PautaDaGrade; sala?: string; dia?: string };

function corDaPauta(situacao: PautaDaGrade["situacao"]): string {
  return situacao === "confirmada" ? "#2E8932" : situacao === "pre_reserva" ? "#B07A14" : "#6B6767";
}

/** A pauta dos espaços: salas nas linhas, dias nas colunas. Conflito (duas confirmadas na mesma sala) e pré-reserva vencendo viram aviso, nunca trava. */
export default function PautaPage() {
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const hoje = new Date().toISOString().slice(0, 10);
  const [inicio, setInicio] = useState(hoje);
  const [salas, setSalas] = useState<SalaDaPauta[] | null>(null);
  const [pautas, setPautas] = useState<PautaDaGrade[]>([]);
  const [folha, setFolha] = useState<Folha | null>(null);
  const [modo, setModo] = useState<"dias" | "ano">("dias");
  const [ano, setAno] = useState(new Date().getFullYear());
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";
  const recarregar = () => setVersao(atual => atual + 1);
  const dias = useMemo(() => diasDaJanela(inicio, DIAS_NA_JANELA), [inicio]);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [sal, esp, pau] = await Promise.all([
        producao.from("producao_salas").select("id, nome, espaco_id").eq("organization_id", organizationId).eq("arquivada", false).order("nome"),
        producao.from("producao_espacos").select("id, nome").eq("organization_id", organizationId).eq("arquivado", false).order("nome"),
        producao.from("producao_pautas").select("id, sala_id, titulo, contratante, inicio, fim, situacao, ordem_na_fila, valida_ate").eq("organization_id", organizationId).gte("fim", `${Number(hoje.slice(0, 4)) - 1}-01-01`),
      ]);
      if (!ativo) return;
      const nomeDoEspaco = new Map((esp.data ?? []).map(espaco => [espaco.id, espaco.nome]));
      setSalas((sal.data ?? [])
        .filter(sala => nomeDoEspaco.has(sala.espaco_id))
        .map(sala => ({ id: sala.id, rotulo: rotuloDoLugar(nomeDoEspaco.get(sala.espaco_id) ?? null, sala.nome) }))
        .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR")));
      setPautas((pau.data ?? []) as PautaDaGrade[]);
      setErro(sal.error || esp.error || pau.error ? "Não foi possível carregar a pauta. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [organizationId, versao, hoje]);

  const conflitos = useMemo(() => pautasEmConflito(pautas), [pautas]);
  const vencendo = useMemo(() => preReservasVencendo(pautas, hoje), [pautas, hoje]);
  const naVez = useMemo(() => {
    const fila = filaDePreReservas(pautas);
    // Só vale avisar quando há fila de verdade: alguém espera atrás da 1ª.
    return fila.filter(item => item.vez && fila.some(outra => outra.pauta.sala_id === item.pauta.sala_id && outra.posicao === 2 && outra.pauta.inicio <= item.pauta.fim && item.pauta.inicio <= outra.pauta.fim));
  }, [pautas]);
  const nomeDaSala = (id: string) => salas?.find(sala => sala.id === id)?.rotulo ?? "";
  const tituloDe = (pauta: PautaDaGrade) => [pauta.titulo, pauta.contratante].filter(Boolean).join(" · ");

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-9">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">Pauta</h1>
            </div>
            {podeEditar && salas && salas.length > 0 && <PrimaryListAction onClick={() => setFolha({})}><Plus size={13} aria-hidden="true" /> Nova pauta</PrimaryListAction>}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Visão da pauta" className="mr-2 inline-flex overflow-hidden rounded border border-black/[.12]">
              {(["dias", "ano"] as const).map(opcao => (
                <button key={opcao} type="button" aria-pressed={modo === opcao} onClick={() => setModo(opcao)} className={`h-10 px-3.5 text-[0.75rem] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7259B5] ${modo === opcao ? "bg-black/[.06] text-[#282525]" : "text-black/55 hover:bg-black/[.04]"}`}>{opcao === "dias" ? "14 dias" : "12 meses"}</button>
              ))}
            </div>
            {modo === "ano" ? (
              <>
                <button type="button" onClick={() => setAno(atual => atual - 1)} aria-label="Ano anterior" className="flex h-10 w-10 items-center justify-center rounded border border-black/[.12] text-black/55 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"><ChevronLeft size={16} aria-hidden="true" /></button>
                <span className="px-2 text-[0.8125rem] font-medium tabular-nums text-[#282525]">{ano}</span>
                <button type="button" onClick={() => setAno(atual => atual + 1)} aria-label="Próximo ano" className="flex h-10 w-10 items-center justify-center rounded border border-black/[.12] text-black/55 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"><ChevronRight size={16} aria-hidden="true" /></button>
              </>
            ) : (<>
            <button type="button" onClick={() => setInicio(atual => somarDias(atual, -7))} aria-label="Semana anterior" className="flex h-10 w-10 items-center justify-center rounded border border-black/[.12] text-black/55 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"><ChevronLeft size={16} aria-hidden="true" /></button>
            <button type="button" onClick={() => setInicio(hoje)} className="h-10 rounded border border-black/[.12] px-3.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Hoje</button>
            <button type="button" onClick={() => setInicio(atual => somarDias(atual, 7))} aria-label="Próxima semana" className="flex h-10 w-10 items-center justify-center rounded border border-black/[.12] text-black/55 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"><ChevronRight size={16} aria-hidden="true" /></button>
            <span className="ml-2 text-[0.75rem] tabular-nums text-black/45">{diaEMes(dias[0])} a {diaEMes(dias[dias.length - 1])}</span>
            </>)}
          </div>
        </div>
      </header>

      <DetailPageContent>
        {erro && <p role="alert" className="mb-4 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {(conflitos.size > 0 || vencendo.length > 0 || naVez.length > 0) && (
          <div className="mb-5 space-y-2" aria-label="Avisos da pauta">
            {conflitos.size > 0 && (
              <p className="flex items-center gap-2 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B07A14]" style={{ borderColor: "#B07A1447" }}>
                <AlertTriangle size={13} aria-hidden="true" /> {conflitos.size} {conflitos.size === 1 ? "pauta confirmada divide" : "pautas confirmadas dividem"} a mesma sala no mesmo dia. Pode ser de propósito (horários diferentes); confira.
              </p>
            )}
            {naVez.map(item => (
              <button key={item.pauta.id} type="button" onClick={() => podeEditar && setFolha({ pauta: item.pauta })} className="flex w-full items-center gap-2 rounded border bg-white px-4 py-2.5 text-left text-[0.75rem] text-[#282525] focus-visible:outline-2 focus-visible:outline-[#7259B5]" style={{ borderColor: "rgba(13,13,13,.14)" }}>
                <AlertTriangle size={13} aria-hidden="true" className="text-black/40" /> A pré-reserva “{item.pauta.titulo}” é a primeira da fila em {nomeDaSala(item.pauta.sala_id)} e o período está livre{item.pauta.contratante ? `: avise ${item.pauta.contratante}` : ""}.
              </button>
            ))}
            {vencendo.map(pauta => (
              <button key={pauta.id} type="button" onClick={() => podeEditar && setFolha({ pauta })} className="flex w-full items-center gap-2 rounded border bg-white px-4 py-2.5 text-left text-[0.75rem] text-[#B07A14] focus-visible:outline-2 focus-visible:outline-[#7259B5]" style={{ borderColor: "#B07A1447" }}>
                <AlertTriangle size={13} aria-hidden="true" /> A pré-reserva “{pauta.titulo}” {pauta.valida_ate && pauta.valida_ate < hoje ? "venceu" : "vence"} em {pauta.valida_ate ? diaEMes(pauta.valida_ate) : ""}.
              </button>
            ))}
          </div>
        )}

        {salas === null ? (
          <div className="h-40 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
        ) : salas.length === 0 ? (
          <div className="rounded border bg-white px-5 py-10 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <p className="text-[0.8125rem] font-medium text-black/55">Nenhuma sala cadastrada</p>
            <p className="mx-auto mt-1 max-w-sm text-[0.75rem] text-black/45">A pauta é por sala. Cadastre o espaço e as salas em Espaços.</p>
          </div>
        ) : modo === "ano" ? (
          <div className="overflow-x-auto rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 z-10 min-w-[11rem] border-b bg-white px-3 py-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45" style={{ borderColor: "rgba(13,13,13,.06)" }}>Sala</th>
                  {MESES.map(mes => <th key={mes} scope="col" className="min-w-[4.5rem] border-b border-l px-2 py-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45" style={{ borderColor: "rgba(13,13,13,.06)" }}>{mes}</th>)}
                </tr>
              </thead>
              <tbody>
                {salas.map(sala => (
                  <tr key={sala.id}>
                    <th scope="row" className="sticky left-0 z-10 border-b bg-white px-3 py-2 text-[0.75rem] font-medium text-[#282525]" style={{ borderColor: "rgba(13,13,13,.06)" }}>{sala.rotulo}</th>
                    {ocupacaoDoAno(pautas, sala.id, ano).map(mes => (
                      <td key={mes.mes} className="border-b border-l p-0 align-top" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                        <button type="button" onClick={() => { setInicio(`${ano}-${String(mes.mes).padStart(2, "0")}-01`); setModo("dias"); }} aria-label={`${MESES[mes.mes - 1]} de ${ano}, ${sala.rotulo}: ${mes.confirmados} dias confirmados, ${mes.preReservas} em pré-reserva, ${mes.consultas} em consulta`} className="flex min-h-[2.75rem] w-full flex-col items-start justify-center gap-0.5 px-2 py-1 text-left text-[0.6875rem] tabular-nums transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7259B5]">
                          {mes.confirmados > 0 && <span className="font-medium text-[#2E8932]">{mes.confirmados} conf.</span>}
                          {mes.preReservas > 0 && <span className="text-[#B07A14]">{mes.preReservas} pré</span>}
                          {mes.consultas > 0 && <span className="text-black/45">{mes.consultas} cons.</span>}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 z-10 min-w-[11rem] border-b bg-white px-3 py-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45" style={{ borderColor: "rgba(13,13,13,.06)" }}>Sala</th>
                  {dias.map(dia => (
                    <th key={dia} scope="col" className={`min-w-[7rem] border-b border-l px-2 py-2 text-[0.625rem] font-medium uppercase tracking-[.08em] ${dia === hoje ? "bg-black/[.04] text-[#282525]" : "text-black/45"}`} style={{ borderColor: "rgba(13,13,13,.06)" }}>
                      {diaDaSemana(dia).slice(0, 3)} {diaEMes(dia)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {salas.map(sala => (
                  <tr key={sala.id}>
                    <th scope="row" className="sticky left-0 z-10 border-b bg-white px-3 py-2 text-[0.75rem] font-medium text-[#282525]" style={{ borderColor: "rgba(13,13,13,.06)" }}>{sala.rotulo}</th>
                    {dias.map(dia => {
                      const doDia = pautasNoDia(pautas, sala.id, dia);
                      return (
                        <td key={dia} className={`border-b border-l align-top ${dia === hoje ? "bg-black/[.02]" : ""}`} style={{ borderColor: "rgba(13,13,13,.06)" }}>
                          <div className="flex min-h-[2.75rem] flex-col gap-1 p-1">
                            {doDia.map(pauta => {
                              const cor = corDaPauta(pauta.situacao);
                              const emConflito = conflitos.has(pauta.id);
                              return (
                                <button key={pauta.id} type="button" disabled={!podeEditar} onClick={() => setFolha({ pauta })} title={`${tituloDe(pauta)} (${ROTULO_DA_SITUACAO_DA_PAUTA[pauta.situacao]}${emConflito ? ", em conflito" : ""}${pauta.ordem_na_fila ? `, ${pauta.ordem_na_fila}ª na fila` : ""})`}
                                  className="flex items-center gap-1 truncate rounded border bg-white px-1.5 py-1 text-left text-[0.6875rem] font-medium focus-visible:outline-2 focus-visible:outline-[#7259B5]" style={{ borderColor: `${cor}47`, color: cor }}>
                                  {emConflito && <AlertTriangle size={11} aria-label="Em conflito" className="shrink-0 text-[#B07A14]" />}
                                  <span className="truncate">{pauta.titulo}</span>
                                </button>
                              );
                            })}
                            {podeEditar && doDia.length === 0 && (
                              <button type="button" onClick={() => setFolha({ sala: sala.id, dia })} aria-label={`Nova pauta em ${sala.rotulo}, ${diaEMes(dia)}`} className="h-full min-h-[2rem] w-full rounded text-[0.75rem] text-transparent transition hover:bg-black/[.04] hover:text-black/35 focus-visible:text-black/45 focus-visible:outline-2 focus-visible:outline-[#7259B5]">+</button>
                            )}
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
      </DetailPageContent>

      {folha && organizationId && salas && (
        <PautaSheet organizationId={organizationId} salas={salas} pautas={pautas} pauta={folha.pauta} salaInicial={folha.sala} diaInicial={folha.dia} onClose={() => setFolha(null)} onSaved={recarregar} />
      )}
    </div>
  );
}
