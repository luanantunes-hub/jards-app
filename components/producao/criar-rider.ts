import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import type { TipoDeObjetoDaPlanta } from "@/lib/producao/estados";
import type { FaseDeEnergia } from "@/lib/producao/estados";
import { gerarRiderDaPlanta } from "@/lib/producao/rider";

/**
 * Cria um rider a partir de uma planta: lê os objetos dela, monta as linhas (`gerarRiderDaPlanta`) e grava o rider e
 * as linhas. Se as linhas falharem, o rider recém-criado é apagado, para não sobrar um rider pela metade.
 * Devolve o id do rider, ou a mensagem de erro para mostrar.
 */
export async function criarRiderDaPlanta(organizationId: string, plantaId: string): Promise<{ id: string } | { erro: string }> {
  const producao = clienteDaProducao(createClient());
  const [pla, obj] = await Promise.all([
    producao.from("producao_plantas").select("id, nome, largura_m, profundidade_m").eq("id", plantaId).maybeSingle(),
    producao.from("producao_planta_objetos").select("id, rotulo, tipo, canais, canal_inicial, potencia_w, circuito, fase").eq("planta_id", plantaId).order("created_at"),
  ]);
  if (pla.error || !pla.data) return { erro: "Não foi possível ler a planta. Tente de novo." };
  if (obj.error) return { erro: "Não foi possível ler os objetos da planta. Tente de novo." };
  const rider = gerarRiderDaPlanta(pla.data, (obj.data ?? []).map(objeto => ({ ...objeto, tipo: objeto.tipo as TipoDeObjetoDaPlanta, fase: objeto.fase as FaseDeEnergia | null })));

  const { data, error } = await producao.from("producao_riders")
    .insert({ organization_id: organizationId, nome: rider.nome, planta_id: plantaId, palco_largura_min_m: rider.palco_largura_min_m, palco_profundidade_min_m: rider.palco_profundidade_min_m })
    .select("id").single();
  if (error || !data) return { erro: error?.code === "42501" ? "Você não pode criar riders aqui." : "Não foi possível criar o rider. Tente de novo." };

  if (rider.itens.length > 0) {
    const { error: erroDasLinhas } = await producao.from("producao_rider_itens").insert(rider.itens.map(item => ({ organization_id: organizationId, rider_id: data.id, ...item })));
    if (erroDasLinhas) {
      await producao.from("producao_riders").delete().eq("id", data.id);
      return { erro: "Não foi possível montar as linhas do rider. Nada foi criado; tente de novo." };
    }
  }
  return { id: data.id };
}
