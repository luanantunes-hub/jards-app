"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { cargaDaTemporada, type ItemParaCarga, type LigacaoItemData, type TotaisDoInventario } from "@/lib/producao/inventario";

const numero = (n: number, casas = 0) => n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** O que a temporada leva (PD2.1): cada item uma vez, na maior quantidade que uma data pede, com o volume e o peso totais. */
export function CargaDaTemporada({ organizationId, temporadaId }: { organizationId: string; temporadaId: string }) {
  const [carga, setCarga] = useState<TotaisDoInventario | null | undefined>(undefined);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const { data: datas } = await producao.from("producao_datas").select("id").eq("temporada_id", temporadaId);
      const ids = (datas ?? []).map(data => data.id);
      if (ids.length === 0) { if (ativo) setCarga(null); return; }
      const { data: ligacoes } = await producao.from("producao_item_datas").select("item_id, data_id, quantidade").in("data_id", ids);
      const itemIds = [...new Set((ligacoes ?? []).map(ligacao => ligacao.item_id))];
      if (itemIds.length === 0) { if (ativo) setCarga(null); return; }
      const { data: itens } = await producao.from("producao_itens").select("id, quantidade, comprimento_cm, largura_cm, altura_cm, peso_kg, dono").eq("organization_id", organizationId).in("id", itemIds);
      if (ativo) setCarga(cargaDaTemporada((ligacoes ?? []) as LigacaoItemData[], (itens ?? []) as ItemParaCarga[]));
    })();
    return () => { ativo = false; };
  }, [organizationId, temporadaId]);

  if (!carga) return null;
  return (
    <section aria-labelledby="carga-da-temporada" className="mt-10">
      <h2 id="carga-da-temporada" className="mb-3 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">O que a temporada leva</h2>
      <div className="flex flex-wrap gap-x-10 gap-y-4 rounded border bg-white px-5 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        <div><p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Itens</p><p className="mt-1 text-[1.125rem] font-semibold tabular-nums text-[#282525]">{numero(carga.itens)} · {numero(carga.unidades)} un.</p></div>
        <div><p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Volume</p><p className="mt-1 text-[1.125rem] font-semibold tabular-nums text-[#282525]">{numero(carga.volumeM3, 2)} m³</p></div>
        <div><p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Peso</p><p className="mt-1 text-[1.125rem] font-semibold tabular-nums text-[#282525]">{numero(carga.pesoKg, 1)} kg</p></div>
      </div>
      {carga.semMedidas > 0 && <p className="mt-2 text-[0.6875rem] text-black/45">{carga.semMedidas} {carga.semMedidas === 1 ? "item está" : "itens estão"} sem dimensões ou peso e fica(m) fora do volume e do peso.</p>}
    </section>
  );
}
