// A CONFIANÇA do modelo explicada por fatores, em vez de só pelo número de semanas: histórico, variação do gasto, eventos e sessões e firmeza do ajuste. Cada fator diz em uma frase o que está bem e
// o que falta. Sem banco e sem imports de servidor: roda na tela e nos testes (tests/ticketeria-modelo-confianca.test.ts).
//
// De onde vêm os números (estudo com dados inventados de resposta conhecida, modelo/estudo_de_corte.py): com 30 e 45 semanas o erro médio por canal foi de cerca de 9 pontos percentuais e o ajuste
// nunca fechou direito (divergências em todas as rodadas); com 58 semanas o erro foi de 6 pontos e o ajuste fechou limpo em 65% das rodadas; com 104, 5 pontos e 100%. Gasto que varia pouco deixou o
// ajuste instável em todas as rodadas. A ORDEM dos canais (qual rende mais): o melhor canal saiu certo em 25% das rodadas com 58 semanas e 60% com 104 (sortear acertaria 33%): por isso a tela nunca
// trata a recomendação de canal como firme (ver `oQueAConfiancaPermite`). Detalhes e tabela em modelo/ESTUDO-DO-CORTE.md.

import { rotuloDoCanalDeGasto, SEMANAS_DA_CONFIANCA_MEDIA, SEMANAS_IDEAIS, type Confianca } from "@/lib/ticketeria/modelo";
import { R_HAT_MAXIMO_ACEITO, type DiagnosticosDoModelo } from "@/lib/ticketeria/modelo-resultado";

/** Com menos sessões que isto o modelo ainda aprende pouco sobre a proximidade da data (a confiança mostrada fica no máximo em média). */
export const MIN_SESSOES_DA_CONFIANCA = 8;

export type FatorDaConfianca = { chave: "historico" | "variacao" | "sessoes" | "ajuste"; estado: "ok" | "atencao"; titulo: string; texto: string };
export type EntradaDosFatores = { semanas: number; diagnosticos: DiagnosticosDoModelo; canais: { canal: string; gasto_constante: boolean }[]; sessoes: number | null; eventos: number | null };

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Os fatores da confiança, na ordem da tela; "eventos e sessões" só entra quando se sabe quantas há. */
export function fatoresDaConfianca(e: EntradaDosFatores): FatorDaConfianca[] {
  const fatores: FatorDaConfianca[] = [];
  fatores.push(e.semanas >= SEMANAS_IDEAIS
    ? { chave: "historico", estado: "ok", titulo: `Histórico: ${e.semanas} semanas`, texto: `Já são as ${SEMANAS_IDEAIS} semanas do ideal.` }
    : { chave: "historico", estado: "atencao", titulo: `Histórico: ${e.semanas} semanas`, texto: e.semanas < SEMANAS_DA_CONFIANCA_MEDIA ? `Abaixo de ${SEMANAS_DA_CONFIANCA_MEDIA} semanas o modelo ainda oscila muito.` : `O ideal são ${SEMANAS_IDEAIS}. Com mais semanas a margem diminui.` });
  const constantes = e.canais.filter(c => c.gasto_constante).map(c => rotuloDoCanalDeGasto(c.canal));
  fatores.push(constantes.length === 0
    ? { chave: "variacao", estado: "ok", titulo: "Gasto varia", texto: `${e.canais.map(c => rotuloDoCanalDeGasto(c.canal)).join(" e ")} mudam o bastante de uma semana para outra.` }
    : { chave: "variacao", estado: "atencao", titulo: "Gasto varia pouco", texto: `No ${constantes.join(" e no ")} o gasto quase não muda: o modelo não separa o efeito do anúncio do que venderia de qualquer jeito. Um pequeno experimento, movendo parte do gasto entre canais, ajuda.` });
  if (e.sessoes !== null) {
    fatores.push(e.sessoes >= MIN_SESSOES_DA_CONFIANCA
      ? { chave: "sessoes", estado: "ok", titulo: "Eventos e sessões", texto: `${e.eventos !== null ? `${plural(e.eventos, "evento", "eventos")} e ` : ""}${plural(e.sessoes, "sessão", "sessões")} no período: o modelo viu a venda subir e cair com a data.` }
      : { chave: "sessoes", estado: "atencao", titulo: "Poucas sessões", texto: `Só ${plural(e.sessoes, "sessão", "sessões")} (o bom são ${MIN_SESSOES_DA_CONFIANCA} ou mais): o modelo ainda aprende pouco sobre a proximidade da data.` });
  }
  const limpo = e.diagnosticos.r_hat_maximo <= R_HAT_MAXIMO_ACEITO && e.diagnosticos.divergencias === 0;
  fatores.push(limpo
    ? { chave: "ajuste", estado: "ok", titulo: "Ajuste firme", texto: "O cálculo fechou limpo, sem divergências." }
    : { chave: "ajuste", estado: "atencao", titulo: "Ajuste instável", texto: `O cálculo não se firmou direito (r-hat ${String(e.diagnosticos.r_hat_maximo).replace(".", ",")}, ${plural(e.diagnosticos.divergencias, "divergência", "divergências")}): leia como indício.` });
  return fatores;
}

/** A confiança que a tela mostra: a do resultado, no máximo em média quando há poucas sessões. */
export function confiancaMostrada(confianca: Confianca, sessoes: number | null): Confianca {
  return confianca === "boa" && sessoes !== null && sessoes < MIN_SESSOES_DA_CONFIANCA ? "media" : confianca;
}

export type Permissao = { estado: "sim" | "cautela" | "nao"; texto: string };
/** O que cada nível de confiança permite fazer com o resultado. A recomendação de canal nunca é "sim": no estudo o melhor canal saiu certo em 60% das rodadas com 104 semanas (25% com 58). */
export function oQueAConfiancaPermite(c: Confianca): Permissao[] {
  return [
    { estado: c === "baixa" ? "cautela" : "sim", texto: c === "baixa" ? "Ver quanto cada canal vendeu: só como indício, com margem muito larga." : "Ver quanto cada canal vendeu, com margem de erro larga." },
    { estado: c === "baixa" ? "cautela" : "sim", texto: "Ver os controles (proximidade da sessão, feriados, cupons)." },
    { estado: c === "baixa" ? "nao" : "cautela", texto: c === "baixa" ? "Ver onde vale investir mais: ainda não." : "Ver onde vale investir mais: aparece como indício." },
    { estado: c === "boa" ? "cautela" : "nao", texto: c === "boa" ? "Apontar um canal: o modelo aponta, mas confirme com um pequeno experimento antes de mudar o orçamento." : `Apontar um canal: pede confiança boa (${SEMANAS_IDEAIS} semanas, gasto variando em todos os canais e ajuste firme).` },
  ];
}
