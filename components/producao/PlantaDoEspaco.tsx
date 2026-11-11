"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Pencil, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { diaDaSemana, diaEMes } from "@/lib/producao/agenda";
import { ocupacaoDaSalaNoDia, ROTULO_DA_SITUACAO_DA_PAUTA, type PautaDaGrade, type SituacaoNoDia } from "@/lib/producao/pauta";
import { somarDias } from "@/lib/producao/tarefas";
import { diasDaSemana, segundaDaSemana } from "@/lib/producao/turnos";

type PlantaDoEspaco = { id: string; nome: string; largura_m: number; profundidade_m: number };
type SalaNaPlanta = { id: string; sala_id: string; rotulo: string; x_m: number; y_m: number; largura_m: number; profundidade_m: number; rotacao_graus: number };

const PINCEL: Record<SituacaoNoDia, { fundo: string; texto: string; contorno: string; tracejado?: string }> = {
  livre: { fundo: "#fff", texto: "#282525", contorno: "rgba(13,13,13,.45)" },
  consulta: { fundo: "rgba(13,13,13,.08)", texto: "#282525", contorno: "rgba(13,13,13,.45)" },
  pre_reserva: { fundo: "url(#hachura-pre-reserva)", texto: "#282525", contorno: "#282525", tracejado: "0.25 0.15" },
  confirmada: { fundo: "#282525", texto: "#fff", contorno: "#282525" },
};
const ROTULO_DA_SITUACAO: Record<SituacaoNoDia, string> = { livre: "Livre", consulta: ROTULO_DA_SITUACAO_DA_PAUTA.consulta, pre_reserva: ROTULO_DA_SITUACAO_DA_PAUTA.pre_reserva, confirmada: ROTULO_DA_SITUACAO_DA_PAUTA.confirmada };
const ORDEM_DA_LEGENDA: SituacaoNoDia[] = ["livre", "consulta", "pre_reserva", "confirmada"];

const corta = (texto: string, limite: number) => (texto.length <= limite ? texto : `${texto.slice(0, Math.max(1, limite - 1))}…`);

/**
 * A planta do espaço com a ocupação (PD3.7): cada sala é um retângulo na planta e a pauta do dia escolhido pinta por cima
 * (livre, consulta, pré-reserva ou confirmada). A ocupação não é guardada: sai das pautas na hora.
 */
export function PlantaDoEspaco({ organizationId, espacoId, nomeDoEspaco, salaIds, podeEditar }: {
  organizationId: string; espacoId: string; nomeDoEspaco: string; salaIds: readonly string[]; podeEditar: boolean;
}) {
  const router = useRouter();
  const hoje = new Date().toISOString().slice(0, 10);
  const [planta, setPlanta] = useState<PlantaDoEspaco | null | undefined>(undefined);
  const [salas, setSalas] = useState<SalaNaPlanta[]>([]);
  const [pautas, setPautas] = useState<PautaDaGrade[]>([]);
  const [dia, setDia] = useState(hoje);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const segunda = useMemo(() => segundaDaSemana(dia), [dia]);
  const dias = useMemo(() => diasDaSemana(segunda), [segunda]);
  const chaveDasSalas = salaIds.join(",");

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const pla = await producao.from("producao_plantas").select("id, nome, largura_m, profundidade_m").eq("espaco_id", espacoId).eq("tipo", "outro").is("sala_id", null).order("created_at").limit(1).maybeSingle();
      const obj = pla.data ? await producao.from("producao_planta_objetos").select("id, sala_id, rotulo, x_m, y_m, largura_m, profundidade_m, rotacao_graus").eq("planta_id", pla.data.id).not("sala_id", "is", null) : { data: [] };
      if (!ativo) return;
      setPlanta(pla.error ? null : (pla.data as PlantaDoEspaco | null));
      setSalas(((obj.data ?? []) as SalaNaPlanta[]));
    })();
    return () => { ativo = false; };
  }, [espacoId]);

  useEffect(() => {
    if (chaveDasSalas === "") return;
    let ativo = true;
    void (async () => {
      const { data } = await clienteDaProducao(createClient()).from("producao_pautas")
        .select("id, sala_id, titulo, contratante, inicio, fim, situacao, ordem_na_fila, valida_ate")
        .in("sala_id", chaveDasSalas.split(",")).lte("inicio", dias[6]).gte("fim", segunda);
      if (ativo) setPautas((data ?? []) as PautaDaGrade[]);
    })();
    return () => { ativo = false; };
  }, [chaveDasSalas, segunda, dias]);

  const ocupacao = useMemo(() => new Map(salas.map(sala => [sala.sala_id, ocupacaoDaSalaNoDia(pautas, sala.sala_id, dia)])), [salas, pautas, dia]);
  const salasOcupadasPorDia = useMemo(() => new Map(dias.map(d => [d, salas.filter(sala => ocupacaoDaSalaNoDia(pautas, sala.sala_id, d).situacao !== "livre").length])), [dias, salas, pautas]);

  async function criar() {
    setCriando(true);
    setErro(null);
    const { data, error } = await clienteDaProducao(createClient()).from("producao_plantas")
      .insert({ organization_id: organizationId, nome: `Planta de ${nomeDoEspaco}`.slice(0, 200), tipo: "outro", largura_m: 30, profundidade_m: 20, espaco_id: espacoId })
      .select("id").single();
    if (error || !data) {
      setCriando(false);
      setErro(error?.code === "42501" ? "Só quem vê a produção inteira cria plantas." : "Não foi possível criar a planta. Tente de novo.");
      return;
    }
    router.push(`/producoes/plantas/${data.id}`);
  }

  const viewBox = planta ? { x: -0.5, y: -0.5, largura: planta.largura_m + 1, altura: planta.profundidade_m + 1 } : null;

  return (
    <section aria-labelledby="planta-do-espaco" className="mt-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="planta-do-espaco" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Planta e ocupação</h2>
        {planta && podeEditar && <Link href={`/producoes/plantas/${planta.id}`} className="inline-flex h-9 items-center gap-1.5 rounded border border-black/[.12] px-3 text-[0.75rem] font-medium text-black/60 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"><Pencil size={13} aria-hidden="true" /> Editar planta</Link>}
      </div>
      {erro && <p role="alert" className="mb-3 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}

      {planta === undefined ? (
        <div className="h-24 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
      ) : planta === null ? (
        <div className="rounded border bg-white px-4 py-5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <p className="text-[0.75rem] text-black/45">Desenhe o espaço com as salas no lugar delas e veja, dia a dia, quais estão livres, em consulta, em pré-reserva ou confirmadas.</p>
          {podeEditar && salaIds.length > 0 && <button type="button" onClick={() => void criar()} disabled={criando} className="mt-3 inline-flex h-10 items-center gap-1.5 rounded bg-[#282525] px-4 text-[0.75rem] font-medium text-white transition hover:bg-[#3A3535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50"><Plus size={13} aria-hidden="true" /> {criando ? "Criando…" : "Criar a planta do espaço"}</button>}
          {salaIds.length === 0 && <p className="mt-2 text-[0.75rem] text-black/45">Cadastre as salas do espaço primeiro.</p>}
        </div>
      ) : salas.length === 0 ? (
        <p className="rounded border bg-white px-4 py-5 text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>A planta “{planta.nome}” ainda não tem salas. {podeEditar ? "Abra o editor e ponha cada sala no lugar dela." : ""}</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setDia(atual => somarDias(atual, -7))} aria-label="Semana anterior" className="inline-flex h-10 w-10 items-center justify-center rounded border border-black/[.12] text-black/55 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"><ChevronLeft size={15} aria-hidden="true" /></button>
              <button type="button" onClick={() => setDia(hoje)} className="inline-flex h-10 items-center rounded border border-black/[.12] px-3.5 text-[0.75rem] font-medium text-black/60 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]" title="Voltar para hoje">Hoje</button>
              <button type="button" onClick={() => setDia(atual => somarDias(atual, 7))} aria-label="Próxima semana" className="inline-flex h-10 w-10 items-center justify-center rounded border border-black/[.12] text-black/55 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"><ChevronRight size={15} aria-hidden="true" /></button>
            </div>
            <div role="group" aria-label="Dia da ocupação" className="flex max-w-full gap-1 overflow-x-auto">
              {dias.map(d => (
                <button key={d} type="button" onClick={() => setDia(d)} aria-pressed={d === dia} className={`flex h-12 min-w-[3.25rem] flex-col items-center justify-center rounded border px-2 text-[0.6875rem] tabular-nums transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${d === dia ? "border-[#282525] bg-black/[.08] text-[#282525]" : d === hoje ? "border-black/[.12] bg-black/[.03] text-black/65 hover:bg-black/[.06]" : "border-black/[.12] text-black/55 hover:bg-black/[.04]"}`}>
                  <span className="font-medium uppercase tracking-[.08em]">{diaDaSemana(d)} {diaEMes(d).slice(0, 2)}</span>
                  <span className="text-[0.625rem] text-black/45">{salasOcupadasPorDia.get(d) ? `${salasOcupadasPorDia.get(d)} em uso` : "livre"}</span>
                </button>
              ))}
            </div>
          </div>

          {viewBox && planta && (
            <div className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <svg viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.largura} ${viewBox.altura}`} role="img" aria-label={`Planta do espaço em ${diaEMes(dia)}: ${salas.map(sala => `${sala.rotulo} ${ROTULO_DA_SITUACAO[ocupacao.get(sala.sala_id)?.situacao ?? "livre"].toLowerCase()}`).join(", ")}`} className="block w-full select-none">
                <defs>
                  <pattern id="hachura-pre-reserva" width="0.5" height="0.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="0.5" height="0.5" fill="#fff" />
                    <line x1="0" y1="0" x2="0" y2="0.5" stroke="rgba(13,13,13,.4)" strokeWidth="0.12" />
                  </pattern>
                </defs>
                <rect x={0} y={0} width={planta.largura_m} height={planta.profundidade_m} fill="#fff" stroke="rgba(13,13,13,.35)" strokeWidth={0.05} />
                {salas.map(sala => {
                  const situacao = ocupacao.get(sala.sala_id)?.situacao ?? "livre";
                  const primeira = ocupacao.get(sala.sala_id)?.pautas[0];
                  const pincel = PINCEL[situacao];
                  const tamanho = Math.max(0.35, Math.min(0.8, (sala.largura_m / Math.max(sala.rotulo.length, 1)) * 1.7));
                  const tamanhoDaPauta = tamanho * 0.75;
                  return (
                    <g key={sala.id} transform={`translate(${sala.x_m} ${sala.y_m}) rotate(${sala.rotacao_graus} ${sala.largura_m / 2} ${sala.profundidade_m / 2})`}>
                      <title>{`${sala.rotulo}: ${ROTULO_DA_SITUACAO[situacao]}${primeira ? ` (${primeira.titulo})` : ""}`}</title>
                      <rect width={sala.largura_m} height={sala.profundidade_m} fill={pincel.fundo} stroke={pincel.contorno} strokeWidth={0.06} strokeDasharray={pincel.tracejado} />
                      {situacao === "pre_reserva" && <rect x={sala.largura_m / 2 - (sala.rotulo.length * tamanho * 0.3) - 0.2} y={sala.profundidade_m / 2 - tamanho * 0.85} width={sala.rotulo.length * tamanho * 0.6 + 0.4} height={tamanho * 1.2} fill="#fff" />}
                      <text x={sala.largura_m / 2} y={sala.profundidade_m / 2} textAnchor="middle" fontSize={tamanho} fill={pincel.texto} style={{ pointerEvents: "none" }}>{sala.rotulo}</text>
                      {primeira && <text x={sala.largura_m / 2} y={sala.profundidade_m / 2 + tamanho * 1.2} textAnchor="middle" fontSize={tamanhoDaPauta} fill={situacao === "confirmada" ? "rgba(255,255,255,.85)" : "rgba(13,13,13,.6)"} style={{ pointerEvents: "none" }}>{corta(primeira.titulo, Math.floor(sala.largura_m / (tamanhoDaPauta * 0.55)))}{ocupacao.get(sala.sala_id)!.pautas.length > 1 ? ` +${ocupacao.get(sala.sala_id)!.pautas.length - 1}` : ""}</text>}
                    </g>
                  );
                })}
              </svg>
            </div>
          )}

          <ul className="mt-3 divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }} aria-label={`Ocupação em ${diaEMes(dia)}`}>
            {salas.map(sala => {
              const { situacao, pautas: doDia } = ocupacao.get(sala.sala_id) ?? { situacao: "livre" as const, pautas: [] };
              return (
                <li key={sala.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2">
                  <span className="min-w-0 flex-1 basis-40 truncate text-[0.8125rem] font-medium text-[#282525]">{sala.rotulo}</span>
                  <span className={`text-[0.6875rem] font-medium ${situacao === "livre" ? "text-black/40" : "text-[#282525]"}`}>{ROTULO_DA_SITUACAO[situacao]}</span>
                  {doDia.length > 0 && <span className="basis-full truncate text-[0.6875rem] text-black/45 sm:basis-auto sm:max-w-[60%]">{doDia.map(pauta => `${pauta.titulo}${pauta.situacao !== situacao ? ` (${ROTULO_DA_SITUACAO_DA_PAUTA[pauta.situacao].toLowerCase()})` : ""}`).join(" · ")}</span>}
                </li>
              );
            })}
          </ul>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.6875rem] text-black/50" aria-label="Legenda">
            {ORDEM_DA_LEGENDA.map(situacao => (
              <li key={situacao} className="flex items-center gap-1.5">
                <svg width="14" height="10" aria-hidden="true"><defs><pattern id={`leg-${situacao}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="#fff" /><line x1="0" y1="0" x2="0" y2="4" stroke="rgba(13,13,13,.4)" strokeWidth="1.2" /></pattern></defs><rect x="0.5" y="0.5" width="13" height="9" fill={situacao === "pre_reserva" ? "url(#leg-pre_reserva)" : PINCEL[situacao].fundo} stroke={PINCEL[situacao].contorno} strokeDasharray={situacao === "pre_reserva" ? "2 1.5" : undefined} /></svg>
                {ROTULO_DA_SITUACAO[situacao]}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
