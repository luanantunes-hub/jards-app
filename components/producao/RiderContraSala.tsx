"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Minus, TriangleAlert } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { ListaDoQueLevar } from "@/components/producao/ListaDoQueLevar";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { papelNaProducao } from "@/lib/producao/permissoes";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { cargaDeEnergia, listaDeCanais, type ObjetoDePalco } from "@/lib/producao/palco";
import { compararRiderComSala, itemDoAcertoDaDiferenca, resumoDaComparacao, type ItemDaComparacao, type OferecidoPelaSala, type SituacaoDaComparacao } from "@/lib/producao/rider-ficha";
import { diaEMes } from "@/lib/producao/agenda";

type SalaDaLista = { id: string; nome: string; espaco_id: string };
type Opcao = { value: string; label: string };

const ROTULO_DA_SITUACAO: Record<SituacaoDaComparacao, string> = { atende: "Atende", nao_atende: "Não atende", sem_dado: "Sem dado" };
const BOTAO_PEQUENO = "h-8 rounded border border-black/12 bg-white px-2.5 text-[0.6875rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";

/**
 * O rider contra a ficha de uma sala (PD4.3, primeiro corte): a medida do palco, os canais e a energia que o cenário pede,
 * lado a lado com o que a sala tem. Os canais e a energia saem da planta ligada ao rider.
 */
export function RiderContraSala({ riderId, plantaId, palcoLarguraMinM, palcoProfundidadeMinM }: { riderId: string; plantaId: string | null; palcoLarguraMinM: number | null; palcoProfundidadeMinM: number | null }) {
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";
  const [opcoes, setOpcoes] = useState<Opcao[] | null>(null);
  const [salaId, setSalaId] = useState("");
  const [ficha, setFicha] = useState<Partial<OferecidoPelaSala> | null>(null);
  const [carregandoFicha, setCarregandoFicha] = useState(false);
  const [objetos, setObjetos] = useState<ObjetoDePalco[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [acertos, setAcertos] = useState<Opcao[]>([]);
  const [acertoId, setAcertoId] = useState("");
  const [pedidos, setPedidos] = useState<Record<string, "pedido" | "ja_estava">>({});
  const [pedindo, setPedindo] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      // Os acertos técnicos que ainda esperam a casa responder: é neles que a diferença vira pergunta.
      const producao = clienteDaProducao(createClient());
      const { data: lista } = await producao.from("producao_acertos").select("id, data_id, modelo_nome").eq("situacao", "aguardando").eq("lado", "casa");
      const ids = [...new Set((lista ?? []).map(item => item.data_id))];
      const { data: datas } = ids.length > 0 ? await producao.from("producao_datas").select("id, data").in("id", ids) : { data: [] as { id: string; data: string }[] };
      if (!ativo) return;
      const dia = new Map((datas ?? []).map(item => [item.id, item.data]));
      setAcertos((lista ?? []).map(item => ({ value: item.id, label: `${dia.get(item.data_id) ? diaEMes(dia.get(item.data_id) as string) : "Data"} · ${item.modelo_nome}` })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")));
    })();
    return () => { ativo = false; };
  }, []);

  /** Cria o item no acerto escolhido; devolve o que aconteceu (e já mostra na linha). A chave repetida do banco vira "ja_estava". */
  async function pedir(item: ItemDaComparacao, ordem: number): Promise<"pedido" | "ja_estava" | "erro"> {
    const novo = itemDoAcertoDaDiferenca(item, ficha);
    if (!novo || !acertoId || !organizationId) return "erro";
    const { error } = await clienteDaProducao(createClient()).from("producao_acerto_itens").insert({ organization_id: organizationId, acerto_id: acertoId, ordem, ...novo });
    if (error?.code === "23505") { setPedidos(atual => ({ ...atual, [`${acertoId}|${item.chave}`]: "ja_estava" })); return "ja_estava"; }
    if (error) { setErro(error.code === "42501" ? "Você não pode mudar este acerto." : "Não foi possível pedir à casa. Tente de novo."); return "erro"; }
    setPedidos(atual => ({ ...atual, [`${acertoId}|${item.chave}`]: "pedido" }));
    return "pedido";
  }

  async function pedirACasa(item: ItemDaComparacao) {
    setPedindo(item.chave);
    setErro(null);
    await pedir(item, 900 + Object.keys(pedidos).length);
    setPedindo(null);
  }

  /** Pede de uma vez todas as diferenças que ainda não estão no acerto escolhido; para na primeira falha. */
  async function pedirTodas(pendentes: readonly ItemDaComparacao[]) {
    setPedindo("todas");
    setErro(null);
    let ordem = 900 + Object.keys(pedidos).length;
    for (const item of pendentes) {
      if (await pedir(item, ordem++) === "erro") break;
    }
    setPedindo(null);
  }

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

  // As diferenças que ainda não viraram pergunta no acerto escolhido.
  const pendentes = itens.filter(item => item.situacao !== "atende" && !pedidos[`${acertoId}|${item.chave}`]);

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
                {podeEditar && itens.some(item => item.situacao !== "atende") && acertos.length > 0 && (
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <div className="w-full max-w-md"><Dropdown ariaLabel="Acerto técnico que recebe o pedido" value={acertoId} onChange={setAcertoId} options={[{ value: "", label: "Pedir à casa neste acerto…" }, ...acertos]} /></div>
                    {acertoId && pendentes.length > 1 && (
                      <button type="button" onClick={() => void pedirTodas(pendentes)} disabled={pedindo !== null} className={BOTAO_PEQUENO}>{pedindo === "todas" ? "Pedindo…" : `Pedir todas à casa (${pendentes.length})`}</button>
                    )}
                  </div>
                )}
                {itens.length > 0 && (
                  <ul className="divide-y divide-black/[.06] overflow-hidden rounded border" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                    {itens.map(item => (
                      <li key={item.chave} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5">
                        <span className="flex w-28 shrink-0 items-center gap-1.5 text-[0.6875rem] font-medium" style={{ color: item.situacao === "nao_atende" ? "#B07A14" : item.situacao === "atende" ? "#282525" : "rgba(13,13,13,.45)" }}>
                          {item.situacao === "atende" ? <Check size={12} aria-hidden="true" /> : item.situacao === "nao_atende" ? <TriangleAlert size={12} aria-hidden="true" /> : <Minus size={12} aria-hidden="true" />}
                          {ROTULO_DA_SITUACAO[item.situacao]}
                        </span>
                        <span className="min-w-0 flex-1 basis-60 text-[0.8125rem] text-[#282525]"><span className="font-medium">{item.rotulo}.</span> {item.texto}</span>
                        {podeEditar && item.situacao !== "atende" && acertoId && (
                          pedidos[`${acertoId}|${item.chave}`]
                            ? <span className="text-[0.6875rem] text-black/45">{pedidos[`${acertoId}|${item.chave}`] === "pedido" ? "Pedido ao acerto" : "Já está no acerto"}</span>
                            : <button type="button" onClick={() => void pedirACasa(item)} disabled={pedindo !== null} className={BOTAO_PEQUENO}>{pedindo === item.chave ? "Pedindo…" : "Pedir à casa"}</button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {organizationId && <ListaDoQueLevar key={salaId} organizationId={organizationId} riderId={riderId} salaId={salaId} salaNome={opcoes.find(opcao => opcao.value === salaId)?.label ?? "a sala"} podeEditar={podeEditar} />}
                {ficha === null && <p className="mt-2 text-[0.6875rem] text-black/45">Esta sala ainda não tem ficha técnica. Preencha em Espaços para a comparação fazer sentido.</p>}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
