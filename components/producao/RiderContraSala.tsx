"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Minus, TriangleAlert } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { cargaDeEnergia, listaDeCanais, type ObjetoDePalco } from "@/lib/producao/palco";
import { compararRiderComSala, resumoDaComparacao, type OferecidoPelaSala, type SituacaoDaComparacao } from "@/lib/producao/rider-ficha";

type SalaDaLista = { id: string; nome: string; espaco_id: string };
type Opcao = { value: string; label: string };

const ROTULO_DA_SITUACAO: Record<SituacaoDaComparacao, string> = { atende: "Atende", nao_atende: "Não atende", sem_dado: "Sem dado" };

/**
 * O rider contra a ficha de uma sala (PD4.3, primeiro corte): a medida do palco, os canais e a energia que o cenário pede,
 * lado a lado com o que a sala tem. Os canais e a energia saem da planta ligada ao rider.
 */
export function RiderContraSala({ plantaId, palcoLarguraMinM, palcoProfundidadeMinM }: { plantaId: string | null; palcoLarguraMinM: number | null; palcoProfundidadeMinM: number | null }) {
  const [opcoes, setOpcoes] = useState<Opcao[] | null>(null);
  const [salaId, setSalaId] = useState("");
  const [ficha, setFicha] = useState<Partial<OferecidoPelaSala> | null>(null);
  const [carregandoFicha, setCarregandoFicha] = useState(false);
  const [objetos, setObjetos] = useState<ObjetoDePalco[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [esp, sal, obj] = await Promise.all([
        producao.from("producao_espacos").select("id, nome").order("nome"),
        producao.from("producao_salas").select("id, nome, espaco_id").eq("arquivada", false).order("nome"),
        plantaId ? producao.from("producao_planta_objetos").select("id, rotulo, tipo, canais, canal_inicial, potencia_w, circuito, fase").eq("planta_id", plantaId) : Promise.resolve({ data: [] }),
      ]);
      if (!ativo) return;
      const nomeDoEspaco = new Map((esp.data ?? []).map(espaco => [espaco.id, espaco.nome]));
      setOpcoes(((sal.data ?? []) as SalaDaLista[]).map(sala => ({ value: sala.id, label: `${nomeDoEspaco.get(sala.espaco_id) ?? "Espaço"} · ${sala.nome}` })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")));
      setObjetos((obj.data ?? []) as ObjetoDePalco[]);
    })();
    return () => { ativo = false; };
  }, [plantaId]);

  useEffect(() => {
    if (!salaId) return;
    let ativo = true;
    void (async () => {
      const { data, error } = await clienteDaProducao(createClient()).from("producao_sala_fichas").select("palco_boca_m, palco_profundidade_m, som_canais_entrada, energia_kva").eq("sala_id", salaId).maybeSingle();
      if (!ativo) return;
      setFicha(data ?? null);
      setErro(error ? "Não foi possível ler a ficha da sala." : null);
      setCarregandoFicha(false);
    })();
    return () => { ativo = false; };
  }, [salaId]);

  const itens = useMemo(() => {
    if (!salaId) return [];
    const canais = listaDeCanais(objetos).total;
    const carga = cargaDeEnergia(objetos).totalW;
    return compararRiderComSala({ palcoLarguraMinM, palcoProfundidadeMinM, canais: canais > 0 ? canais : null, cargaW: carga > 0 ? carga : null }, ficha);
  }, [salaId, ficha, objetos, palcoLarguraMinM, palcoProfundidadeMinM]);

  return (
    <section aria-labelledby="rider-contra-sala">
      <h2 id="rider-contra-sala" className="mb-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Comparar com uma sala</h2>
      <div className="rounded border bg-white p-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        {opcoes === null ? (
          <div className="h-10 rounded bg-black/[.03] motion-safe:animate-pulse" />
        ) : opcoes.length === 0 ? (
          <p className="text-[0.75rem] text-black/45">Cadastre um espaço com salas e a ficha técnica delas para comparar o rider com o que a casa tem.</p>
        ) : (
          <>
            <div className="max-w-md">
              <Dropdown ariaLabel="Sala para comparar" value={salaId} onChange={valor => { setSalaId(valor); setFicha(null); setCarregandoFicha(Boolean(valor)); }} options={[{ value: "", label: "Escolha a sala" }, ...opcoes]} />
            </div>
            {erro && <p role="alert" className="mt-3 text-[0.75rem] text-[#B23B3B]">{erro}</p>}
            {salaId && !carregandoFicha && (
              <div className="mt-4">
                <p className="mb-2 text-[0.75rem] text-black/55">{resumoDaComparacao(itens)}</p>
                {itens.length > 0 && (
                  <ul className="divide-y divide-black/[.06] overflow-hidden rounded border" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                    {itens.map(item => (
                      <li key={item.chave} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5">
                        <span className="flex w-28 shrink-0 items-center gap-1.5 text-[0.6875rem] font-medium" style={{ color: item.situacao === "nao_atende" ? "#B07A14" : item.situacao === "atende" ? "#282525" : "rgba(13,13,13,.45)" }}>
                          {item.situacao === "atende" ? <Check size={12} aria-hidden="true" /> : item.situacao === "nao_atende" ? <TriangleAlert size={12} aria-hidden="true" /> : <Minus size={12} aria-hidden="true" />}
                          {ROTULO_DA_SITUACAO[item.situacao]}
                        </span>
                        <span className="min-w-0 flex-1 basis-60 text-[0.8125rem] text-[#282525]"><span className="font-medium">{item.rotulo}.</span> {item.texto}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {ficha === null && <p className="mt-2 text-[0.6875rem] text-black/45">Esta sala ainda não tem ficha técnica. Preencha em Espaços para a comparação fazer sentido.</p>}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
