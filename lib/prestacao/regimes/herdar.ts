// Regime derivado de outro (P1.11): a versão anterior de uma norma costuma
// repetir a maior parte das regras da seguinte, e as fontes só conferem as
// diferenças. O derivado parte de uma cópia do regime base com toda fonte
// marcada "a confirmar" (a checagem só alerta) e com uma nota dizendo onde a
// regra foi conferida; as diferenças conhecidas entram por cima, com a
// própria fonte, sem a marca.

import type { RegimeNormativo } from "./tipos";

function marcar(valor: unknown, nota: string): unknown {
  if (Array.isArray(valor)) return valor.map(item => marcar(item, nota));
  if (!valor || typeof valor !== "object") return valor;
  const copia: Record<string, unknown> = {};
  for (const [chave, filho] of Object.entries(valor)) {
    if (chave === "fonte" && filho && typeof filho === "object") {
      const fonte = filho as { nota?: string };
      copia.fonte = { ...fonte, aConfirmar: true, nota: fonte.nota ? `${nota} ${fonte.nota}` : nota };
    } else {
      copia[chave] = marcar(filho, nota);
    }
  }
  return copia;
}

/** Cópia do regime com toda fonte "a confirmar" e a nota de onde a regra foi conferida. */
export function herdarRegime(base: RegimeNormativo, nota: string): RegimeNormativo {
  return marcar(base, nota) as RegimeNormativo;
}
