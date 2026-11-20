"use client";

import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { diaEMes } from "@/lib/producao/agenda";
import { cargaPorVeiculo, itensParaPreencher, ondeEstaCadaItem, ROTULO_DA_SITUACAO_DO_ITEM, type CargaDoVeiculo, type LinhaParaOnde, type OndeEstaOItem } from "@/lib/producao/checklist";
import { ROTULO_DO_DESLOCAMENTO } from "@/lib/producao/deslocamentos";
import type { TipoDeDeslocamento } from "@/lib/producao/estados";

type SemTransporte = { item_id: string; nome: string; quantidade: number };

const numero = (n: number, casas = 0) => n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas });

/**
 * A carga por veículo da temporada (PD6.12): o que vai em cada veículo (pelo checklist de cada deslocamento), o peso e o volume contra
 * a capacidade, e o que a temporada leva e ainda não está em nenhum deslocamento.
 */
export function CargaPorVeiculo({ organizationId, temporadaId }: { organizationId: string; temporadaId: string }) {
  const [carga, setCarga] = useState<CargaDoVeiculo[] | null>(null);
  const [semTransporte, setSemTransporte] = useState<SemTransporte[]>([]);
  const [onde, setOnde] = useState<OndeEstaOItem[]>([]);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const { data: datas } = await producao.from("producao_datas").select("id, data").eq("temporada_id", temporadaId);
      const idsDasDatas = (datas ?? []).map(data => data.id);
      if (idsDasDatas.length === 0) { if (ativo) setCarga([]); return; }
      const diaDaData = new Map((datas ?? []).map(data => [data.id, data.data]));
      const [des, lig] = await Promise.all([
        producao.from("producao_deslocamentos").select("id, data_id, tipo, origem, destino, veiculo_id").in("data_id", idsDasDatas),
        producao.from("producao_item_datas").select("item_id, quantidade").in("data_id", idsDasDatas),
      ]);
      const idsDosDeslocamentos = (des.data ?? []).map(item => item.id);
      const linhas = idsDosDeslocamentos.length > 0
        ? await producao.from("producao_checklist_itens").select("deslocamento_id, tipo, quantidade, item_id, nome, saida, volta").in("deslocamento_id", idsDosDeslocamentos)
        : { data: [] as LinhaParaOnde[] };
      const idsDosVeiculos = [...new Set((des.data ?? []).map(item => item.veiculo_id).filter((id): id is string => Boolean(id)))];
      const idsDosItens = [...new Set([...(linhas.data ?? []).map(linha => linha.item_id), ...(lig.data ?? []).map(ligacao => ligacao.item_id)].filter((id): id is string => Boolean(id)))];
      const [vei, itens] = await Promise.all([
        idsDosVeiculos.length > 0 ? producao.from("producao_veiculos").select("id, nome, capacidade_carga_kg, capacidade_volume_m3").in("id", idsDosVeiculos) : Promise.resolve({ data: [] as { id: string; nome: string; capacidade_carga_kg: number | null; capacidade_volume_m3: number | null }[] }),
        idsDosItens.length > 0 ? producao.from("producao_itens").select("id, nome, comprimento_cm, largura_cm, altura_cm, peso_kg").eq("organization_id", organizationId).in("id", idsDosItens) : Promise.resolve({ data: [] as { id: string; nome: string; comprimento_cm: number | null; largura_cm: number | null; altura_cm: number | null; peso_kg: number | null }[] }),
      ]);
      if (!ativo) return;
      const medidas = new Map((itens.data ?? []).map(item => [item.id, { comprimento_cm: item.comprimento_cm, largura_cm: item.largura_cm, altura_cm: item.altura_cm, peso_kg: item.peso_kg }]));
      const veiculos = new Map((vei.data ?? []).map(item => [item.id, item]));
      const doTrecho = (des.data ?? []).map(item => ({
        id: item.id, veiculo_id: item.veiculo_id, dia: diaDaData.get(item.data_id) ?? "",
        rotulo: [ROTULO_DO_DESLOCAMENTO[item.tipo as TipoDeDeslocamento], [item.origem, item.destino].filter(Boolean).join(" → ")].filter(Boolean).join(" "),
      }));
      setCarga(cargaPorVeiculo(doTrecho, linhas.data ?? [], medidas, veiculos));
      setOnde(ondeEstaCadaItem(doTrecho, (linhas.data ?? []) as LinhaParaOnde[]));
      // O que a temporada leva (a maior quantidade que uma data pede) e ainda não está no checklist de nenhum deslocamento.
      const necessarios = new Map<string, number>();
      for (const ligacao of lig.data ?? []) necessarios.set(ligacao.item_id, Math.max(necessarios.get(ligacao.item_id) ?? 0, ligacao.quantidade));
      const nomes = new Map((itens.data ?? []).map(item => [item.id, item.nome]));
      const noChecklist = new Set((linhas.data ?? []).map(linha => linha.item_id).filter((id): id is string => Boolean(id)));
      setSemTransporte(itensParaPreencher([...necessarios].map(([item_id, quantidade]) => ({ item_id, nome: nomes.get(item_id) ?? "Item", quantidade })), noChecklist));
    })();
    return () => { ativo = false; };
  }, [organizationId, temporadaId]);

  if (carga === null || (carga.length === 0 && semTransporte.length === 0)) return null;
  return (
    <>
    <section aria-labelledby="carga-por-veiculo" className="mt-10">
      <h2 id="carga-por-veiculo" className="mb-3 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Carga por veículo</h2>
      {carga.length > 0 && (
        <div className="space-y-3">
          {carga.map(veiculo => (
            <div key={veiculo.veiculoId ?? "sem"} className="rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <p className="border-b px-4 py-2.5 text-[0.8125rem] font-semibold text-[#282525]" style={{ borderColor: "rgba(13,13,13,.06)" }}>{veiculo.nome}</p>
              <ul className="divide-y divide-black/[.06]">
                {veiculo.deslocamentos.map(item => (
                  <li key={item.id} className="px-4 py-2.5">
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
                      <span className="min-w-0 flex-1 basis-56 text-[0.8125rem] text-[#282525]">{item.rotulo}{item.dia ? <span className="text-black/45"> · {diaEMes(item.dia)}</span> : null}</span>
                      <span className="text-[0.75rem] tabular-nums text-black/55">{numero(item.unidades)} un. · {numero(item.pesoKg, 1)} kg · {numero(item.volumeM3, 2)} m³</span>
                    </div>
                    {item.semMedidas > 0 && <p className="mt-0.5 text-[0.6875rem] text-black/40">{item.semMedidas} {item.semMedidas === 1 ? "item sem medida fica fora" : "itens sem medida ficam fora"} da soma.</p>}
                    {item.avisos.map(aviso => <p key={aviso} className="mt-0.5 flex items-start gap-1.5 text-[0.6875rem]" style={{ color: "#B07A14" }}><TriangleAlert size={12} aria-hidden="true" className="mt-px shrink-0" />{aviso}</p>)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {semTransporte.length > 0 && (
        <div className="mt-3 rounded border bg-white px-4 py-3" style={{ borderColor: "#B07A1447" }}>
          <p className="text-[0.8125rem] font-medium" style={{ color: "#B07A14" }}>Ainda sem veículo ({semTransporte.length})</p>
          <p className="mt-1 text-[0.75rem] text-black/55">{semTransporte.map(item => `${item.nome} × ${numero(item.quantidade)}`).join(", ")}</p>
        </div>
      )}
    </section>
      {onde.length > 0 && (
        <section aria-labelledby="onde-esta-cada-item" className="mt-10">
          <h2 id="onde-esta-cada-item" className="mb-3 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Onde está cada item</h2>
          <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            {onde.map(item => {
              const problema = item.situacao === "faltou" || item.situacao === "avariado";
              return (
                <li key={item.chave} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 px-4 py-2.5">
                  <span className="min-w-0 flex-1 basis-56 text-[0.8125rem] text-[#282525]">{item.nome}{item.quantidade > 1 ? <span className="tabular-nums text-black/45"> × {numero(item.quantidade)}</span> : null}</span>
                  <span className="text-[0.75rem] text-black/55">{item.texto}{item.dia ? ` · ${item.deslocamento}, ${diaEMes(item.dia)}` : ` · ${item.deslocamento}`}</span>
                  <span className="rounded border bg-white px-2 py-1 text-[0.625rem] font-medium" style={problema ? { borderColor: "#B23B3B47", color: "#B23B3B" } : { borderColor: "rgba(13,13,13,.16)", color: "rgba(13,13,13,.6)" }}>{ROTULO_DA_SITUACAO_DO_ITEM[item.situacao]}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
