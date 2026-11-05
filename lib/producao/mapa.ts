// O mapa da turnê (plano do módulo, PD1.14): as praças em ordem de data sobre o mapa do Brasil, com a distância em
// linha reta entre elas. Sem tela, sem rede e sem banco.

import { distanciaKm } from "@/lib/prestacao/municipios";

/** O retângulo do Brasil (com folga) e o tamanho do desenho. */
const LAT_NORTE = 5.6, LAT_SUL = -33.9, LON_OESTE = -74.2, LON_LESTE = -34.5;
const LARGURA = 600;
// Equiretangular com a escala de longitude corrigida pelo cosseno da latitude média (-14°): as formas não achatam.
const FATOR_LON = Math.cos((-14 * Math.PI) / 180);
const ALTURA = Math.round((LARGURA * (LAT_NORTE - LAT_SUL)) / ((LON_LESTE - LON_OESTE) * FATOR_LON));

export const TAMANHO_DO_MAPA = { largura: LARGURA, altura: ALTURA };

/** Latitude e longitude → ponto do desenho (x para a direita, y para baixo). */
export function projetar(latitude: number, longitude: number): { x: number; y: number } {
  return {
    x: ((longitude - LON_OESTE) / (LON_LESTE - LON_OESTE)) * LARGURA,
    y: ((LAT_NORTE - latitude) / (LAT_NORTE - LAT_SUL)) * ALTURA,
  };
}

/** Todos os municípios como pontos de um só traço (cada "M x y h0" com ponta redonda vira um ponto): o contorno do país. */
export function tracoDoPais(municipios: readonly (readonly [string, string, string, number, number])[]): string {
  return municipios.map(m => {
    const { x, y } = projetar(m[3], m[4]);
    return `M${x.toFixed(1)} ${y.toFixed(1)}h0`;
  }).join("");
}

export type DataComLugar = { id: string; data: string; chave: string; nome: string; latitude: number; longitude: number };
export type Parada = { chave: string; nome: string; latitude: number; longitude: number; datas: string[]; kmDaAnterior: number | null };

/**
 * As praças em ordem de data. Datas seguidas no mesmo lugar viram uma parada só; voltar a um lugar depois de outro
 * é parada nova. `kmDaAnterior` é a linha reta da parada anterior (a primeira não tem).
 */
export function paradasDaTurne(datas: readonly DataComLugar[]): Parada[] {
  const ordenadas = [...datas].sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));
  const paradas: Parada[] = [];
  for (const item of ordenadas) {
    const ultima = paradas[paradas.length - 1];
    if (ultima && ultima.chave === item.chave) { ultima.datas.push(item.data); continue; }
    paradas.push({
      chave: item.chave, nome: item.nome, latitude: item.latitude, longitude: item.longitude, datas: [item.data],
      kmDaAnterior: ultima ? Math.round(distanciaKm(ultima, item)) : null,
    });
  }
  return paradas;
}

export function totalDeKm(paradas: readonly Parada[]): number {
  return paradas.reduce((soma, parada) => soma + (parada.kmDaAnterior ?? 0), 0);
}
