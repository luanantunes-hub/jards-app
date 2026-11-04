"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BedDouble, Bus, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { diaDaSemana, diaEMes, ROTULO_DO_TIPO_DE_DATA } from "@/lib/producao/agenda";
import { instanteParaHoraLocal, rotuloDaHora, ROTULO_DO_TIPO_DE_BLOCO } from "@/lib/producao/dia";
import { ROTULO_DA_CONFIRMACAO, rotuloDoHorario } from "@/lib/producao/escala";
import { agoraEProximo, type FolhaDaEquipe, type MinhaData } from "@/lib/producao/folha";
import type { TipoBloco } from "@/lib/producao/vocabulario";

type RespostaDaFuncao = PromiseLike<{ data: unknown; error: { message: string } | null }>;

/**
 * Chama uma função do banco da pessoa convidada. O cliente tipado só conhece as funções do app; estas quatro
 * (fn_equipe_*) não são de tabela nenhuma: devolvem só o que é da pessoa logada, e o tipo do resultado vem de folha.ts.
 */
function chamar(nome: string, argumentos?: Record<string, unknown>): RespostaDaFuncao {
  const supabase = createClient();
  return (supabase.rpc as unknown as (nome: string, argumentos?: Record<string, unknown>) => RespostaDaFuncao).call(supabase, nome, argumentos);
}

const ROTULO = "text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45";
const BORDA = { borderColor: "rgba(13,13,13,.10)" };

/** O nome do bloco como a folha mostra: o título, ou o do tipo. */
const nomeDoBloco = (bloco: { titulo: string | null; tipo: string }) => bloco.titulo ?? ROTULO_DO_TIPO_DE_BLOCO[bloco.tipo as TipoBloco] ?? bloco.tipo;

/** "Minha folha": a página da pessoa da equipe convidada. Só mostra o que é dela, pelas funções fn_equipe_*. */
export default function MinhaFolhaPage() {
  const [datas, setDatas] = useState<MinhaData[] | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [folha, setFolha] = useState<FolhaDaEquipe | null | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);
  const [respondendo, setRespondendo] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    let ativo = true;
    void (async () => {
      // Liga a conta aos convites do e-mail (só vale com o e-mail confirmado) e lê as datas.
      await chamar("fn_equipe_aceitar");
      const { data, error } = await chamar("fn_equipe_minhas_datas");
      if (!ativo) return;
      setDatas((data ?? []) as MinhaData[]);
      setErro(error ? "Não foi possível carregar suas datas. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    const relogio = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(relogio);
  }, []);

  const abrir = useCallback(async (dataId: string) => {
    setAberta(dataId);
    setFolha(undefined);
    const { data, error } = await chamar("fn_equipe_folha", { p_data_id: dataId });
    setFolha(error ? null : (data as FolhaDaEquipe | null));
  }, []);

  async function responder(resposta: "confirmada" | "recusada" | "pendente") {
    if (!folha) return;
    setRespondendo(true);
    setErro(null);
    const { error } = await chamar("fn_equipe_responder", { p_escala_id: folha.escala.id, p_resposta: resposta });
    setRespondendo(false);
    if (error) { setErro("Não foi possível guardar sua resposta. Tente de novo."); return; }
    setFolha({ ...folha, escala: { ...folha.escala, confirmacao: resposta } });
    setDatas(atual => atual?.map(item => (item.escala_id === folha.escala.id ? { ...item, confirmacao: resposta } : item)) ?? atual);
  }

  const proximas = useMemo(() => {
    const hoje = new Date(agora).toISOString().slice(0, 10);
    return (datas ?? []).filter(item => (item.data_fim ?? item.data) >= hoje);
  }, [datas, agora]);
  const passadas = useMemo(() => (datas ?? []).filter(item => !proximas.includes(item)), [datas, proximas]);

  const marcadores = useMemo(() => (folha ? agoraEProximo(folha.blocos, agora) : { agora: null, proximo: null }), [folha, agora]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[28rem] bg-white px-5 pb-12 pt-6">
      {erro && <p role="alert" className="mb-4 rounded border bg-white px-3 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}

      {aberta === null ? (
        <>
          <h1 className="text-[1.375rem] font-semibold tracking-[-.02em] text-[#282525]">Minha folha</h1>
          <p className="mt-1 text-[0.8125rem] text-black/55">As datas em que você trabalha, com o seu horário.</p>
          {datas === null ? (
            <div className="mt-6 h-24 rounded bg-black/[.02] motion-safe:animate-pulse" />
          ) : datas.length === 0 ? (
            <div className="mt-6 rounded border px-4 py-8 text-center" style={BORDA}>
              <p className="text-[0.8125rem] font-medium text-black/55">Nenhuma data por aqui ainda</p>
              <p className="mt-1 text-[0.75rem] text-black/45">Entre com o mesmo e-mail que a produção usou no convite. Quando você for escalado, a data aparece aqui.</p>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {[{ titulo: "Próximas", itens: proximas }, { titulo: "Passadas", itens: passadas }].filter(grupo => grupo.itens.length > 0).map(grupo => (
                <section key={grupo.titulo}>
                  <h2 className={`mb-2 ${ROTULO}`}>{grupo.titulo}</h2>
                  <ul className="space-y-2">
                    {grupo.itens.map(item => (
                      <li key={item.escala_id}>
                        <button type="button" onClick={() => void abrir(item.data_id)} className="w-full rounded border bg-white p-3.5 text-left transition hover:bg-black/[.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]" style={BORDA}>
                          <span className="flex items-baseline justify-between gap-3">
                            <span className="text-[0.9375rem] font-semibold text-[#282525]">{diaDaSemana(item.data)}, {diaEMes(item.data)}</span>
                            <span className="text-[0.6875rem] text-black/50">{item.situacao === "cancelada" ? "Cancelada" : ROTULO_DA_CONFIRMACAO[item.confirmacao]}</span>
                          </span>
                          <span className="mt-0.5 block text-[0.75rem] text-black/60">{ROTULO_DO_TIPO_DE_DATA[item.tipo]} · {item.temporada_titulo}</span>
                          <span className="mt-0.5 block text-[0.6875rem] text-black/45">{[item.funcao, rotuloDoHorario(item, item.fuso), item.organizacao_nome].filter(Boolean).join(" · ")}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      ) : folha === undefined ? (
        <div className="h-48 rounded bg-black/[.02] motion-safe:animate-pulse" />
      ) : folha === null ? (
        <>
          <button type="button" onClick={() => setAberta(null)} className="mb-4 inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-black/50"><ArrowLeft size={14} aria-hidden="true" /> Minhas datas</button>
          <p className="text-[0.8125rem] text-black/55">Não foi possível abrir esta data. Ela pode ter sido mudada ou o seu acesso, retirado.</p>
        </>
      ) : (
        <div className="space-y-5">
          <button type="button" onClick={() => setAberta(null)} className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-black/50 focus-visible:outline-2 focus-visible:outline-[#7259B5]"><ArrowLeft size={14} aria-hidden="true" /> Minhas datas</button>
          <header>
            <p className="text-[0.6875rem] text-black/45">{folha.data.organizacao_nome} · {folha.data.temporada_titulo}</p>
            <h1 className="mt-1 text-[1.375rem] font-semibold tracking-[-.02em] text-[#282525]">{diaDaSemana(folha.data.data)}, {diaEMes(folha.data.data)}</h1>
            <p className="text-[0.8125rem] text-black/60">{[ROTULO_DO_TIPO_DE_DATA[folha.data.tipo], folha.data.uf].filter(Boolean).join(" · ")}{folha.data.situacao === "cancelada" ? " · cancelada" : ""}</p>
          </header>

          <section className="rounded border p-3.5" style={BORDA}>
            <p className="text-[0.8125rem] font-semibold text-[#282525]">{folha.escala.funcao ?? "Você está escalado"}</p>
            <p className="mt-0.5 text-[0.75rem] text-black/60">{rotuloDoHorario(folha.escala, folha.data.fuso) || "Sem horário de chamada ainda"}</p>
            {folha.data.situacao === "cancelada" ? null : folha.escala.confirmacao === "pendente" ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" disabled={respondendo} onClick={() => void responder("confirmada")} className="h-11 rounded bg-[#2E8932] text-[0.8125rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">Confirmo</button>
                <button type="button" disabled={respondendo} onClick={() => void responder("recusada")} className="h-11 rounded border border-black/15 bg-white text-[0.8125rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">Não posso</button>
              </div>
            ) : (
              <p className="mt-3 flex items-center gap-1.5 text-[0.75rem] text-black/60">
                {folha.escala.confirmacao === "confirmada" && <Check size={13} aria-hidden="true" className="text-[#2E8932]" />}
                {folha.escala.confirmacao === "confirmada" ? "Você confirmou. A produção já sabe." : "Você avisou que não pode. A produção já sabe."}
                <button type="button" disabled={respondendo} onClick={() => void responder("pendente")} className="ml-auto text-[0.6875rem] font-medium text-black/45 underline underline-offset-2 disabled:opacity-50">Desfazer</button>
              </p>
            )}
          </section>

          {(marcadores.agora || marcadores.proximo) && (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded bg-black/[.04] p-3">
                <p className={ROTULO}>Agora</p>
                <p className="mt-1 text-[0.875rem] font-semibold text-[#282525]">{marcadores.agora ? nomeDoBloco(marcadores.agora) : "—"}</p>
                {marcadores.agora?.fim && <p className="text-[0.6875rem] text-black/50">até {instanteParaHoraLocal(marcadores.agora.fim, folha.data.fuso).hora}</p>}
              </div>
              <div className="rounded border p-3" style={BORDA}>
                <p className={ROTULO}>Próximo</p>
                <p className="mt-1 text-[0.875rem] font-semibold text-[#282525]">{marcadores.proximo ? nomeDoBloco(marcadores.proximo) : "—"}</p>
                {marcadores.proximo?.inicio && <p className="text-[0.6875rem] text-black/50">às {instanteParaHoraLocal(marcadores.proximo.inicio, folha.data.fuso).hora}</p>}
              </div>
            </div>
          )}

          {folha.blocos.length > 0 && (
            <section>
              <h2 className={ROTULO}>O dia</h2>
              <ul className="mt-2 divide-y divide-black/[.06]">
                {folha.blocos.map(bloco => (
                  <li key={bloco.id} className="flex gap-3 py-2 text-[0.75rem]">
                    <span className="w-28 shrink-0 tabular-nums text-black/55">{rotuloDaHora(bloco, folha.data.fuso) || "—"}</span>
                    <span className="text-[#282525]">{nomeDoBloco(bloco)}{bloco.confirmado ? "" : <span className="text-black/40"> · a confirmar</span>}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {folha.cartoes.length > 0 && (
            <section className="space-y-3">
              <h2 className={ROTULO}>Viagem e hotel</h2>
              {folha.cartoes.map(cartao => {
                const Icone = cartao.tipo === "viagem" ? Bus : BedDouble;
                const horas = [cartao.inicio, cartao.fim].map(instante => (instante ? instanteParaHoraLocal(instante, folha.data.fuso).hora : null));
                return (
                  <div key={cartao.tipo} className="flex gap-2.5 text-[0.75rem] text-[#282525]">
                    <Icone size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-black/40" />
                    <div className="min-w-0">
                      <p className="font-medium">{cartao.titulo ?? (cartao.tipo === "viagem" ? "Viagem do dia" : "Hospedagem")}</p>
                      {(horas[0] || horas[1]) && <p className="text-black/60">{[horas[0], horas[1]].filter(Boolean).join(" às ")}</p>}
                      {cartao.endereco && <p className="break-words text-black/60">{cartao.endereco}</p>}
                      {cartao.localizador && <p className="text-black/60">Reserva: {cartao.localizador}</p>}
                      {cartao.notas && <p className="whitespace-pre-line break-words text-black/60">{cartao.notas}</p>}
                    </div>
                  </div>
                );
              })}
            </section>
          )}
        </div>
      )}
    </main>
  );
}
