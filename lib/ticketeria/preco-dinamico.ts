// O PREÇO DINÂMICO POR ADESÃO (plano da Ticketeria, seção 11, fase P2): a conta que move o FATOR de preço de uma sessão. Só lógica, sem banco e sem imports de servidor: roda na tela e nos testes
// (tests/ticketeria-preco-dinamico.test.ts); quem lê e grava é lib/ticketeria/preco-dinamico-servidor.ts.
//
// O fator é em pontos-base (10000 = o preço-base; 11000 = 10% acima). A cada intervalo o atualizador pede a direção do quadro de precificação (P1: subir, manter, baixar ou sem comparação) e move o fator UM
// PASSO nessa direção, sem passar do piso nem do teto do produtor. Nas últimas 48 horas antes da sessão o preço só pode baixar. Sem comparação, o preço fica onde está. A direção mira a receita e a lotação do
// produtor, nunca a comissão do Jards, e o sinal são vendas pagas (nunca visitas). Os padrões e as 48 horas são PROPOSTAS (plano, seção 11.6) que o dono confirma.

import type { DirecaoDoPreco } from "@/lib/ticketeria/precificacao";

export const FATOR_BASE = 10000;
/** Nas últimas horas antes da sessão o preço não sobe (só baixa). */
export const HORAS_SEM_SUBIR = 48;
/** A versão do texto do aceite. É um RASCUNHO para o advogado: troque quando o texto for aprovado, e o aceite guardado de cada produtor diz qual texto ele aceitou. */
export const VERSAO_DO_ACEITE = "rascunho-1";

export type RegraDinamica = { ativo: boolean; pisoBps: number; tetoBps: number; passoBps: number; intervaloMinutos: number };

/** Os padrões propostos: até 20% abaixo e 30% acima do preço-base, 10% por passo, no máximo a cada 6 horas. */
export const REGRA_PADRAO: Omit<RegraDinamica, "ativo"> = { pisoBps: -2000, tetoBps: 3000, passoBps: 1000, intervaloMinutos: 360 };

/** Os limites do produtor (já fora da faixa de segurança do banco: piso de -90% a 0, teto de 0 a +1000%, passo de 1% a 50%, intervalo de 30 min a 24 h). */
export const LIMITES_DA_REGRA = { piso: { min: -9000, max: 0 }, teto: { min: 0, max: 100000 }, passo: { min: 100, max: 5000 }, intervalo: { min: 30, max: 1440 } } as const;

export function limitesDoFator(r: Pick<RegraDinamica, "pisoBps" | "tetoBps">): { min: number; max: number } {
  return { min: FATOR_BASE + r.pisoBps, max: FATOR_BASE + r.tetoBps };
}

/** O preço depois do fator: nunca abaixo de 1 centavo (e zero fica zero: gratuito e cortesia). A mesma conta de fn_ticketeria_preco_do_lote, no banco. */
export function aplicarFator(precoCentavos: number, fatorBps: number): number {
  if (fatorBps === FATOR_BASE || precoCentavos === 0) return precoCentavos;
  return Math.max(1, Math.round((precoCentavos * fatorBps) / FATOR_BASE));
}

/** O fator em frase curta: "preço-base", "+10%" ou "−5%". */
export function textoDoFator(fatorBps: number): string {
  const pontos = fatorBps - FATOR_BASE;
  if (pontos === 0) return "preço-base";
  const pct = Math.abs(pontos) / 100;
  const texto = Number.isInteger(pct) ? String(pct) : pct.toFixed(1).replace(".", ",");
  return `${pontos > 0 ? "+" : "−"}${texto}%`;
}

export type ProximoFator = { fatorBps: number; mudou: boolean; direcao: DirecaoDoPreco; motivo: string };

/** O fator da sessão no próximo passo. `minutosDesdeAUltima` é o tempo desde a última MUDANÇA de fator (null se nunca mudou). */
export function proximoFator(e: { regra: RegraDinamica; fatorAtualBps: number; direcao: DirecaoDoPreco; horasAteASessao: number; minutosDesdeAUltima: number | null }): ProximoFator {
  const { regra, direcao } = e;
  const { min, max } = limitesDoFator(regra);
  const manter = (motivo: string): ProximoFator => ({ fatorBps: e.fatorAtualBps, mudou: false, direcao, motivo });
  // Se o produtor estreitou a faixa, o fator entra nela já, sem esperar o intervalo.
  if (e.fatorAtualBps > max || e.fatorAtualBps < min) {
    const dentro = Math.min(max, Math.max(min, e.fatorAtualBps));
    return { fatorBps: dentro, mudou: true, direcao, motivo: `A faixa do produtor mudou: o preço entrou nela (${textoDoFator(dentro)}).` };
  }
  if (e.minutosDesdeAUltima !== null && e.minutosDesdeAUltima < regra.intervaloMinutos) return manter(`Aguardando o intervalo de ${regra.intervaloMinutos} minutos desde a última mudança.`);
  if (direcao === "sem_comparacao") return manter("Sem comparação com eventos parecidos: o preço fica onde está.");
  if (direcao === "manter") return manter("No ritmo esperado: o preço fica onde está.");
  if (direcao === "subir" && e.horasAteASessao <= HORAS_SEM_SUBIR) return manter(`Faltam ${HORAS_SEM_SUBIR} horas ou menos para a sessão: o preço só pode baixar.`);
  const alvo = direcao === "subir" ? e.fatorAtualBps + regra.passoBps : e.fatorAtualBps - regra.passoBps;
  const novo = Math.min(max, Math.max(min, alvo));
  if (novo === e.fatorAtualBps) return manter(direcao === "subir" ? "No teto do produtor: o preço não sobe mais." : "No piso do produtor: o preço não baixa mais.");
  return { fatorBps: novo, mudou: true, direcao, motivo: `${direcao === "subir" ? "Vendas acima do esperado" : "Vendas abaixo do esperado"}: ${textoDoFator(e.fatorAtualBps)} para ${textoDoFator(novo)} (passo de ${regra.passoBps / 100}%).` };
}

/** O texto do aceite (RASCUNHO para o advogado; a versão guardada com o aceite é VERSAO_DO_ACEITE). Só aparece quando a plataforma libera o recurso. */
export const PONTOS_DO_ACEITE: readonly string[] = [
  "O preço de cada sessão pode subir ou baixar, dentro da faixa que você define, conforme as vendas pagas e a lotação, no máximo uma vez a cada intervalo.",
  `Nas últimas ${HORAS_SEM_SUBIR} horas antes da sessão o preço só pode baixar.`,
  "O comprador vê o preço do momento e um aviso de que o valor varia conforme a demanda. O preço do carrinho vale durante a reserva, e nada muda depois de pago.",
  "A meia-entrada acompanha: vale metade do preço do momento.",
  "A comissão do Jards é uma porcentagem do preço final: se o preço sobe, a comissão sobe também. A direção sugerida não leva a comissão em conta.",
  "Projetos de lei de incentivo costumam ter regras de preço. O Jards não confere esses limites: se o seu projeto tem limite, não use o preço dinâmico e ponha o valor que quiser.",
  "Você pode desligar quando quiser, e o preço de todas as sessões volta ao preço-base.",
];

export type LeituraDaRegra = { ok: true; pisoBps: number; tetoBps: number; passoBps: number; intervaloMinutos: number } | { ok: false; erro: string };

const numeroDigitado = (bruto: string): number | null => {
  const limpo = bruto.trim().replace(",", ".");
  if (limpo === "" || !/^\d+(\.\d+)?$/.test(limpo)) return null;
  return Number(limpo);
};

/** A regra digitada na tela: piso e teto em % sobre o preço-base (piso "20" é −20%), passo em % e intervalo em horas. Devolve em pontos-base e minutos, dentro dos limites do banco. */
export function lerRegraDaTela(campos: { piso: string; teto: string; passo: string; intervaloHoras: string }): LeituraDaRegra {
  const piso = numeroDigitado(campos.piso);
  const teto = numeroDigitado(campos.teto);
  const passo = numeroDigitado(campos.passo);
  const horas = numeroDigitado(campos.intervaloHoras);
  if (piso === null || piso > LIMITES_DA_REGRA.piso.min / -100) return { ok: false, erro: `Quanto o preço pode baixar: de 0 a ${LIMITES_DA_REGRA.piso.min / -100}%.` };
  if (teto === null || teto > LIMITES_DA_REGRA.teto.max / 100) return { ok: false, erro: `Quanto o preço pode subir: de 0 a ${LIMITES_DA_REGRA.teto.max / 100}%.` };
  if (passo === null || passo < LIMITES_DA_REGRA.passo.min / 100 || passo > LIMITES_DA_REGRA.passo.max / 100) return { ok: false, erro: `A mudança por vez vai de ${LIMITES_DA_REGRA.passo.min / 100}% a ${LIMITES_DA_REGRA.passo.max / 100}%.` };
  const minutos = horas === null ? null : Math.round(horas * 60);
  if (minutos === null || minutos < LIMITES_DA_REGRA.intervalo.min || minutos > LIMITES_DA_REGRA.intervalo.max) return { ok: false, erro: "O intervalo vai de meia hora (0,5) a 24 horas." };
  return { ok: true, pisoBps: 0 - Math.round(piso * 100), tetoBps: Math.round(teto * 100), passoBps: Math.round(passo * 100), intervaloMinutos: minutos };
}
