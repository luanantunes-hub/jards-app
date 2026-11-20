import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { listaDoQueLevar, type EquipamentoDaCasa, type LigacaoDaLinha, type LinhaDoQueLevar, type LinhaDoRider } from "@/lib/producao/levar";

export type QueLevarDoRider = { riderId: string; riderNome: string; lista: LinhaDoQueLevar[] };
export type QueLevarDaData = { salaId: string | null; salaNome: string | null; obraId: string | null; riders: QueLevarDoRider[] };

/**
 * O que levar numa data (PD4.4): a sala da data e o(s) rider(s) da obra da data (a da temporada, se a data não tiver). Sem sala ou sem rider, a lista vem vazia.
 * Lê só o que a pessoa pode ver; quem não pode (o banco recusa) recebe a lista vazia.
 */
export async function carregarQueLevarDaData(dataId: string): Promise<QueLevarDaData> {
  const producao = clienteDaProducao(createClient());
  const { data: data } = await producao.from("producao_datas").select("obra_id, sala_id, espaco_id, temporada_id").eq("id", dataId).maybeSingle();
  if (!data) return { salaId: null, salaNome: null, obraId: null, riders: [] };
  const temporada = data.obra_id ? null : await producao.from("producao_temporadas").select("obra_id").eq("id", data.temporada_id).maybeSingle();
  const obraId = data.obra_id ?? temporada?.data?.obra_id ?? null;
  const [sala, riders] = await Promise.all([
    data.sala_id ? producao.from("producao_salas").select("nome, espaco_id").eq("id", data.sala_id).maybeSingle() : Promise.resolve({ data: null }),
    obraId ? producao.from("producao_riders").select("id, nome").eq("obra_id", obraId).order("nome") : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
  ]);
  const salaId = data.sala_id ?? null;
  const espacoId = sala.data?.espaco_id ?? data.espaco_id ?? null;
  const salaNome = sala.data?.nome ?? null;
  if (!salaId || !espacoId || !riders.data || riders.data.length === 0) return { salaId, salaNome, obraId, riders: [] };

  const riderIds = riders.data.map(item => item.id);
  const [itens, equipamentos] = await Promise.all([
    producao.from("producao_rider_itens").select("id, rider_id, secao, texto, quantidade, obrigatorio, ordem").in("rider_id", riderIds).order("ordem").order("created_at"),
    producao.from("producao_equipamentos").select("id, nome, categoria, quantidade, estado, sala_id, espaco_id").eq("espaco_id", espacoId),
  ]);
  const itemIds = (itens.data ?? []).map(item => item.id);
  const ligacoes = itemIds.length > 0 ? await producao.from("producao_rider_item_equipamentos").select("rider_item_id, equipamento_id").in("rider_item_id", itemIds) : { data: [] as LigacaoDaLinha[] };
  return {
    salaId, salaNome, obraId,
    riders: riders.data.map(rider => ({
      riderId: rider.id, riderNome: rider.nome,
      lista: listaDoQueLevar(
        (itens.data ?? []).filter(item => item.rider_id === rider.id) as unknown as LinhaDoRider[], (ligacoes.data ?? []) as LigacaoDaLinha[], (equipamentos.data ?? []) as EquipamentoDaCasa[], salaId, espacoId,
      ),
    })),
  };
}
