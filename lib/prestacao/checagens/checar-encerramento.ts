// O saldo no encerramento (P9.4). O regime diz o prazo do saldo
// (contas.saldo.prazo): na saúde, saldo e rendimentos da Conta Movimento por
// GRU em 30 dias improrrogáveis do término, sob pena de tomada de contas
// especial (Anexo LXXXVI-A, art. 71); na LIE, o pedido de transferência para
// outro projeto. Depois do fim da execução, enquanto as guias do saldo não
// estão pagas e a conta do projeto não está zerada no último extrato, o
// achado aponta o prazo, a guia a pagar ou o saldo que ficou.

import { recolhimentoDoEncerramento } from "../devolucoes";
import { descreverRegra, prazoDoSaldo } from "../prazo-final";
import { centavos, dataBr, novoAchado, reais, type Achado, type EstadoDaPrestacao } from "./catalogo";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function checarEncerramento(estado: EstadoDaPrestacao): Achado[] {
  const fim = estado.prestacao?.data_fim_execucao ?? null;
  const prazo = prazoDoSaldo(estado.regime, { data_fim_execucao: fim });
  if (!prazo || !fim) return [];
  const hoje = (estado.hoje ?? new Date()).toISOString().slice(0, 10);
  if (hoje <= fim) return [];

  const guias = recolhimentoDoEncerramento(estado.devolucoes ?? []);
  if (guias.guias > 0 && guias.aPagar === 0) return [];

  // A conta que devolve: a de movimento (ou a única); a de captação é recolhida pelo órgão na saúde.
  const contas = (estado.contas ?? []).filter(c => c.tipo === "movimento" || c.tipo === "unica");
  const saldos = (estado.saldos ?? []).filter(s => contas.some(c => c.id === s.conta_id) && s.data >= fim);
  const saldo = saldos.reduce((t, s) => t + centavos(s.saldo), 0);
  const ultimaData = saldos.map(s => s.data).sort().at(-1) ?? null;
  if (!guias.aPagar && contas.length > 0 && saldos.length === contas.length && saldo === 0) return [];

  const vencido = hoje > prazo.data;
  const abertura = vencido
    ? `O prazo do saldo venceu em ${dataBr(prazo.data)} (${descreverRegra(prazo.regra)})`
    : `${prazo.rotulo} até ${dataBr(prazo.data)} (${descreverRegra(prazo.regra)})`;
  const situacao = guias.aPagar
    ? `${plural(guias.aPagar, "guia do saldo está", "guias do saldo estão")} a pagar, ${reais(guias.valorAPagar)}`
    : saldo > 0
      ? `a conta do projeto tinha ${reais(saldo)} no último extrato${ultimaData ? `, de ${dataBr(ultimaData)}` : ""}`
      : "registre a guia em Devoluções, ou importe o extrato que mostra a conta zerada";
  return [novoAchado(estado.regime, {
    codigo: "SALDO_DO_ENCERRAMENTO",
    severidade: "alerta",
    entidade: { tipo: "prestacao", id: null },
    ref: "saldo",
    mensagem: `${abertura}: ${situacao}. ${prazo.regra.descricao}.`,
    dados: { prazo: prazo.data, fim_execucao: fim, vencido: vencido ? 1 : 0, saldo: saldo / 100, guias_a_pagar: guias.aPagar },
    fonte: { ...prazo.regra.fonte },
  })];
}
