// A planta que entra na ficha técnica de cada sala (PD3.5, terceiro corte): a leitura do banco, uma planta por sala.
//
// Uma sala pode ter várias plantas (PD2.2). Na ficha entra **a mais recente** de cada sala, com os objetos dela.
// Quem lê a ficha já pode ler a planta (as duas seguem o acesso do espaço), então não há regra nova aqui.

import type { ClienteDaProducao } from "@/lib/producao/cliente";
import type { PlantaParaPdf } from "@/lib/producao/planta-desenho";

/** A planta mais recente de cada sala, pronta para o desenho. Sala sem planta não entra no mapa. */
export async function plantasDasSalas(producao: ClienteDaProducao, salaIds: readonly string[]): Promise<Map<string, PlantaParaPdf>> {
  const porSala = new Map<string, PlantaParaPdf>();
  if (salaIds.length === 0) return porSala;
  const { data: plantas } = await producao
    .from("producao_plantas")
    .select("id, nome, largura_m, profundidade_m, sala_id")
    .in("sala_id", salaIds as string[])
    .order("updated_at", { ascending: false });
  const escolhidas = new Map<string, { id: string; nome: string; largura_m: number; profundidade_m: number }>();
  for (const planta of plantas ?? []) {
    if (!planta.sala_id || escolhidas.has(planta.sala_id)) continue;
    escolhidas.set(planta.sala_id, { id: planta.id, nome: planta.nome, largura_m: planta.largura_m, profundidade_m: planta.profundidade_m });
  }
  if (escolhidas.size === 0) return porSala;
  const { data: objetos } = await producao
    .from("producao_planta_objetos")
    .select("planta_id, rotulo, x_m, y_m, largura_m, profundidade_m, rotacao_graus")
    .in("planta_id", [...escolhidas.values()].map(planta => planta.id));
  for (const [salaId, planta] of escolhidas) {
    porSala.set(salaId, {
      nome: planta.nome,
      largura_m: planta.largura_m,
      profundidade_m: planta.profundidade_m,
      objetos: (objetos ?? []).filter(objeto => objeto.planta_id === planta.id).map(objeto => ({
        rotulo: objeto.rotulo, x_m: objeto.x_m, y_m: objeto.y_m, largura_m: objeto.largura_m, profundidade_m: objeto.profundidade_m, rotacao_graus: objeto.rotacao_graus,
      })),
    });
  }
  return porSala;
}
