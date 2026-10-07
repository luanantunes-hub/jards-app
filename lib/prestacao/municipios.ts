// Municípios do Brasil com código do IBGE e coordenadas da sede (P3.2). O
// local de realização grava o código e as coordenadas quando a pessoa escolhe
// o município, e a posição lida na foto é conferida com elas. A tabela fica em
// public/dados/municipios.json, gerada por scripts/prestacao-gerar-municipios.ts.
// Sem React e sem Supabase.

/** [código IBGE, nome, UF, latitude, longitude]. */
export type Municipio = readonly [string, string, string, number, number];

export type TabelaMunicipios = {
  fonte: string;
  licenca: string;
  gerada_em: string;
  municipios: Municipio[];
};

export const CAMINHO_MUNICIPIOS = "/dados/municipios.json";

/** Linhas de um CSV simples (sem aspas com vírgula dentro), com o cabeçalho como chaves. */
function linhasCsv(texto: string): Record<string, string>[] {
  const [cabecalho, ...linhas] = texto.replace(/^﻿/, "").trim().split(/\r?\n/);
  const colunas = cabecalho.split(",").map(c => c.trim());
  return linhas.filter(Boolean).map(linha => {
    const valores = linha.split(",");
    return Object.fromEntries(colunas.map((c, i) => [c, (valores[i] ?? "").trim()]));
  });
}

/** Junta municipios.csv (código, nome, coordenadas, código da UF) e estados.csv (código e sigla). */
export function lerCsvMunicipios(municipiosCsv: string, estadosCsv: string, fonte: string, data: string): TabelaMunicipios {
  const siglas = new Map(linhasCsv(estadosCsv).map(e => [e.codigo_uf, e.uf]));
  const municipios: Municipio[] = linhasCsv(municipiosCsv).map(m => {
    const uf = siglas.get(m.codigo_uf);
    const latitude = Number(m.latitude), longitude = Number(m.longitude);
    if (!/^\d{7}$/.test(m.codigo_ibge) || !uf || !m.nome || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error(`Linha inválida: ${JSON.stringify(m)}`);
    }
    return [m.codigo_ibge, m.nome, uf, latitude, longitude] as const;
  });
  municipios.sort((a, b) => a[2].localeCompare(b[2]) || a[1].localeCompare(b[1], "pt-BR"));
  return { fonte, licenca: "MIT", gerada_em: data, municipios };
}

const normal = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function municipiosDaUf(tabela: Pick<TabelaMunicipios, "municipios">, uf: string): Municipio[] {
  return tabela.municipios.filter(m => m[2] === uf);
}

/** O município da UF com esse nome, sem ligar para acento, caixa e hífen. */
export function acharMunicipio(tabela: Pick<TabelaMunicipios, "municipios">, uf: string, nome: string): Municipio | null {
  const alvo = normal(nome);
  return tabela.municipios.find(m => m[2] === uf && normal(m[1]) === alvo) ?? null;
}

/** Busca por trecho do nome dentro da UF: primeiro os que começam com o trecho. */
export function buscarMunicipios(tabela: Pick<TabelaMunicipios, "municipios">, uf: string, trecho: string, limite = 50): Municipio[] {
  const alvo = normal(trecho);
  const daUf = municipiosDaUf(tabela, uf);
  if (!alvo) return daUf.slice(0, limite);
  const comeca = daUf.filter(m => normal(m[1]).startsWith(alvo));
  const contem = daUf.filter(m => !normal(m[1]).startsWith(alvo) && normal(m[1]).includes(alvo));
  return [...comeca, ...contem].slice(0, limite);
}

/** Distância em km entre dois pontos (fórmula de haversine). */
export function distanciaKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}
