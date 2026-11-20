// O mapa de palco (plano do módulo, PD2.4 e PD2.5): a lista de canais e a carga de energia que saem dos objetos da
// planta. Sem tela e sem banco.

import type { FaseDeEnergia, TipoDeObjetoDaPlanta } from "@/lib/producao/estados";

export const ROTULO_DO_TIPO_DE_OBJETO: Record<TipoDeObjetoDaPlanta, string> = {
  instrumento: "Instrumento", praticavel: "Praticável", cenario: "Cenário", monitor: "Monitor", microfone: "Microfone", energia: "Ponto de energia", outro: "Outro",
};

export type ObjetoDePalco = {
  id: string; rotulo: string; tipo: TipoDeObjetoDaPlanta; canais: number | null; canal_inicial: number | null;
  potencia_w: number | null; circuito: string | null; fase: FaseDeEnergia | null;
};

export type LinhaDeCanal = { canal: number; objetoId: string; rotulo: string; fonte: string };
export type ListaDeCanais = { linhas: LinhaDeCanal[]; conflitos: { canal: number; fontes: string[] }[]; total: number };

const nomeDaFonte = (objeto: ObjetoDePalco, indice: number, de: number) => (de > 1 ? `${objeto.rotulo} (${indice + 1}/${de})` : objeto.rotulo);

/**
 * A lista de canais. Quem tem canal fixado fica onde foi fixado; os outros, na ordem em que vieram, ocupam o primeiro
 * trecho livre a partir do canal 1. Dois objetos fixados no mesmo canal aparecem em `conflitos` (e as duas linhas
 * continuam na lista).
 */
export function listaDeCanais(objetos: readonly ObjetoDePalco[]): ListaDeCanais {
  const comCanal = objetos.filter(objeto => (objeto.canais ?? 0) > 0);
  const ocupados = new Set<number>();
  const linhas: LinhaDeCanal[] = [];
  const poe = (objeto: ObjetoDePalco, inicio: number) => {
    const de = objeto.canais ?? 0;
    for (let i = 0; i < de; i++) {
      ocupados.add(inicio + i);
      linhas.push({ canal: inicio + i, objetoId: objeto.id, rotulo: objeto.rotulo, fonte: nomeDaFonte(objeto, i, de) });
    }
  };
  for (const objeto of comCanal.filter(item => item.canal_inicial !== null)) poe(objeto, objeto.canal_inicial as number);
  for (const objeto of comCanal.filter(item => item.canal_inicial === null)) {
    const de = objeto.canais ?? 0;
    let inicio = 1;
    const cabe = (s: number) => Array.from({ length: de }, (_, i) => s + i).every(canal => !ocupados.has(canal));
    while (!cabe(inicio)) inicio++;
    poe(objeto, inicio);
  }
  linhas.sort((a, b) => a.canal - b.canal);
  const porCanal = new Map<number, string[]>();
  for (const linha of linhas) porCanal.set(linha.canal, [...(porCanal.get(linha.canal) ?? []), linha.fonte]);
  const conflitos = [...porCanal].filter(([, fontes]) => fontes.length > 1).map(([canal, fontes]) => ({ canal, fontes }));
  return { linhas, conflitos, total: linhas.length ? Math.max(...linhas.map(linha => linha.canal)) : 0 };
}

export type LinhaDeEnergia = { circuito: string; fase: FaseDeEnergia | null; objetos: number; potenciaW: number; correnteA: number };
export type CargaDeEnergia = {
  linhas: LinhaDeEnergia[]; totalW: number; porFase: Record<FaseDeEnergia | "sem", number>;
  /** (maior − menor) ÷ maior entre as fases com carga, em %; nulo com menos de duas fases em uso. */
  desequilibrioPct: number | null; tensaoV: number;
};

/** A carga por circuito e fase (corrente = potência ÷ tensão, sem fator de potência) e o desequilíbrio entre as fases. */
export function cargaDeEnergia(objetos: readonly ObjetoDePalco[], tensaoV = 220): CargaDeEnergia {
  const grupos = new Map<string, LinhaDeEnergia>();
  const porFase: Record<FaseDeEnergia | "sem", number> = { R: 0, S: 0, T: 0, sem: 0 };
  for (const objeto of objetos) {
    const potencia = objeto.potencia_w ?? 0;
    if (potencia <= 0) continue;
    const circuito = objeto.circuito?.trim() || "Sem circuito";
    const chave = `${circuito}\u0000${objeto.fase ?? ""}`;
    const atual = grupos.get(chave) ?? { circuito, fase: objeto.fase, objetos: 0, potenciaW: 0, correnteA: 0 };
    atual.objetos += 1;
    atual.potenciaW += potencia;
    grupos.set(chave, atual);
    porFase[objeto.fase ?? "sem"] += potencia;
  }
  const linhas = [...grupos.values()]
    .map(linha => ({ ...linha, correnteA: Math.round((linha.potenciaW / tensaoV) * 10) / 10 }))
    .sort((a, b) => a.circuito.localeCompare(b.circuito, "pt-BR", { numeric: true }) || (a.fase ?? "").localeCompare(b.fase ?? ""));
  const usadas = (["R", "S", "T"] as const).map(fase => porFase[fase]).filter(valor => valor > 0);
  const maior = Math.max(0, ...usadas), menor = Math.min(...usadas);
  return {
    linhas, totalW: linhas.reduce((soma, linha) => soma + linha.potenciaW, 0), porFase, tensaoV,
    desequilibrioPct: usadas.length >= 2 ? Math.round(((maior - menor) / maior) * 100) : null,
  };
}

const celula = (valor: string | number | null) => {
  const texto = valor === null ? "" : String(valor);
  return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};
const csv = (linhas: (string | number | null)[][]) => "﻿" + linhas.map(linha => linha.map(celula).join(";")).join("\r\n") + "\r\n";

/** A planilha da lista de canais (separada por ponto e vírgula, com BOM: abre certo no Excel em português). */
export function csvDosCanais(lista: ListaDeCanais): string {
  return csv([["Canal", "Fonte"], ...lista.linhas.map(linha => [linha.canal, linha.fonte])]);
}

export function csvDaEnergia(carga: CargaDeEnergia): string {
  return csv([
    ["Circuito", "Fase", "Objetos", "Potência (W)", `Corrente a ${carga.tensaoV} V (A)`],
    ...carga.linhas.map(linha => [linha.circuito, linha.fase ?? "", linha.objetos, linha.potenciaW, String(linha.correnteA).replace(".", ",")]),
    ["Total", "", "", carga.totalW, String(Math.round((carga.totalW / carga.tensaoV) * 10) / 10).replace(".", ",")],
  ]);
}
