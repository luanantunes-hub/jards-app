// Conferência de um regime derivado na própria norma (P1.11).
//
// O derivado nasce com as regras da norma seguinte, todas "a confirmar"
// (herdar.ts). A conferência é a leitura da norma antiga regra a regra, e cada
// regra conferida entra numa lista:
// - confirmada: a norma antiga diz o mesmo; troca a fonte;
// - diferente: a norma antiga diz outra coisa; troca os campos da regra e a fonte;
// - removida: a norma antiga não tem a regra, e ela é só da norma seguinte.
//
// O caminho é o da fonte no regime pronto, no formato de caminhoDaFonte:
// chaves separadas por ponto e itens de lista pelo código, tipo ou resultado
// ("pagamentos.regras[estorno].fonte"), ou pela posição quando não há nenhum.

import type { Fonte, RegimeNormativo } from "./tipos";

export type AjusteConferido =
  | { caminho: string; fonte: Fonte; regra?: Record<string, unknown> }
  | { caminho: string; remover: string };

type No = Record<string, unknown>;

function chaveDoItem(item: unknown, posicao: number): string {
  const no = item as No | null;
  const chave = no?.codigo ?? no?.tipo ?? no?.resultado;
  return String(chave ?? posicao);
}

function ehFonte(valor: unknown): valor is Fonte {
  const no = valor as No | null;
  return !!no && typeof no === "object" && typeof no.documento === "string" && typeof no.dispositivo === "string";
}

/** Cada fonte do regime com o caminho e o objeto que a contém (a regra). */
export function fontesComCaminho(regime: RegimeNormativo): { caminho: string; dono: No; lista?: unknown[] }[] {
  const saida: { caminho: string; dono: No; lista?: unknown[] }[] = [];
  function percorrer(valor: unknown, caminho: string, lista?: unknown[]) {
    if (Array.isArray(valor)) {
      valor.forEach((item, i) => percorrer(item, `${caminho}[${chaveDoItem(item, i)}]`, valor));
      return;
    }
    if (!valor || typeof valor !== "object") return;
    for (const [chave, filho] of Object.entries(valor as No)) {
      const aqui = caminho ? `${caminho}.${chave}` : chave;
      if (ehFonte(filho)) saida.push({ caminho: aqui, dono: valor as No, lista });
      else percorrer(filho, aqui);
    }
  }
  percorrer(regime, "");
  return saida;
}

/**
 * Aplica a conferência a uma cópia do regime. Caminho que não existe é erro:
 * a lista tem de acompanhar o regime (o teste de cobertura roda isto).
 */
export function aplicarConferencia(regime: RegimeNormativo, ajustes: readonly AjusteConferido[]): RegimeNormativo {
  const copia = structuredClone(regime) as RegimeNormativo;
  const fontes = new Map<string, { dono: No; lista?: unknown[] }>();
  for (const item of fontesComCaminho(copia)) {
    if (fontes.has(item.caminho)) throw new Error(`Caminho repetido no regime ${regime.codigo}: ${item.caminho}`);
    fontes.set(item.caminho, item);
  }

  const vistos = new Set<string>();
  const remocoes: { dono: No; lista: unknown[] }[] = [];
  for (const ajuste of ajustes) {
    if (vistos.has(ajuste.caminho)) throw new Error(`Ajuste repetido em ${regime.codigo}: ${ajuste.caminho}`);
    vistos.add(ajuste.caminho);
    const alvo = fontes.get(ajuste.caminho);
    if (!alvo) throw new Error(`Caminho conferido que não existe em ${regime.codigo}: ${ajuste.caminho}`);

    if ("remover" in ajuste) {
      if (!alvo.lista || !ajuste.caminho.endsWith("].fonte")) {
        throw new Error(`Só item de lista pode sair (${regime.codigo}): ${ajuste.caminho}`);
      }
      remocoes.push({ dono: alvo.dono, lista: alvo.lista });
      continue;
    }
    if (ajuste.regra) Object.assign(alvo.dono, ajuste.regra);
    alvo.dono.fonte = ajuste.fonte;
  }

  for (const { dono, lista } of remocoes) lista.splice(lista.indexOf(dono), 1);
  return copia;
}
