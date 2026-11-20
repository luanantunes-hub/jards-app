// Checagens da captação diante da liberação da execução (P9.1), pelas faixas
// do regime (lib/prestacao/captacao.ts). Na saúde (Anexo LXXXVI-A, arts. 56
// a 60): execução só com 100% captado; de 60% a 99,99%, só depois da
// readequação para menor aprovada, pedida em 30 dias do fim da captação;
// abaixo de 60% no fim da captação, indeferimento; acima de 120% do aprovado,
// o excedente é recolhido.
//  * pagamentos com a captação abaixo do que libera a execução;
//  * readequação que cabe e não foi pedida, com o prazo do fim da captação;
//  * captação encerrada abaixo do mínimo da redução;
//  * captação acima do acréscimo máximo.

import { situacaoDaCaptacao, percentualDaCaptacao } from "../captacao";
import { ehDespesa } from "../despesas";
import { basesDoOrcamento, montarArvore } from "../orcamento";
import { regraDoRegime } from "../regimes";
import { captadoDoExtrato } from "./checar-financeiro";
import { centavos, dataBr, novoAchado, reais, type Achado, type EstadoDaPrestacao } from "./catalogo";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function checarCaptacao(estado: EstadoDaPrestacao): Achado[] {
  const { regime } = estado;
  const orcamento = estado.nos?.length ? centavos(basesDoOrcamento(montarArvore(estado.nos, []).raizes, regime).valorTotalProjeto) : null;
  const s = situacaoDaCaptacao(regime, {
    captado: captadoDoExtrato(estado),
    aprovado: estado.valorAprovado ? centavos(estado.valorAprovado) : null,
    orcamentoVigente: orcamento || null,
    alteracoes: estado.alteracoes ?? [],
    dataFimCaptacao: estado.prestacao?.data_fim_captacao ?? null,
  });
  if (!s || s.faixa === "sem_aporte") return [];
  const { regra } = s;
  const hoje = (estado.hoje ?? new Date()).toISOString().slice(0, 10);
  const fimDaCaptacao = estado.prestacao?.data_fim_captacao ?? null;
  const base = s.readequada ? "do valor readequado" : "do aprovado";
  const achados: Achado[] = [];

  // Pagamentos feitos sem a captação que libera a execução.
  if (s.faixa === "abaixo_do_minimo" || s.faixa === "readequacao_para_menor") {
    const rejeitadas = new Set(estado.despesas.filter(d => d.status === "rejeitado" || !ehDespesa(d.tipo)).map(d => d.id));
    const pagos = estado.pagamentos.filter(p => !rejeitadas.has(p.despesa_id));
    if (pagos.length) {
      const soma = pagos.reduce((t, p) => t + centavos(p.valor), 0);
      const motivo = s.faixa === "readequacao_para_menor"
        ? s.readequacaoPedida
          ? "a execução só começa com a readequação para menor aprovada, e a pedida ainda não tem decisão"
          : "a execução só começa com a readequação para menor aprovada"
        : `a execução só começa com ${regra.liberacao}% ${base} captado`;
      achados.push(novoAchado(regime, {
        codigo: "EXECUCAO_SEM_CAPTACAO_MINIMA",
        severidade: "alerta",
        entidade: { tipo: "prestacao", id: null },
        ref: "captacao",
        mensagem: `${plural(pagos.length, "pagamento", "pagamentos")} (${reais(soma)}) com ${percentualDaCaptacao(s.percentual)} ${base} captado (${reais(s.captado)} de ${reais(s.aCaptar)}): ${motivo}. Confira se o extrato da conta de captação está completo.`,
        dados: { pagamentos: pagos.length, valor: soma / 100, captado: s.captado / 100, a_captar: s.aCaptar / 100, percentual: Math.round(s.percentual * 10) / 10 },
        fonte: { ...regra.fontes.liberacao },
      }));
    }
  }

  // A readequação que cabe e não foi pedida: para menor é obrigatória; para maior, só para usar o excedente.
  const cabeReadequacao = s.faixa === "readequacao_para_menor" || s.faixa === "acrescimo" || s.faixa === "excedente";
  if (cabeReadequacao && !s.readequada && !s.readequacaoPedida && regra.prazoDaReadequacao) {
    const paraMenor = s.faixa === "readequacao_para_menor";
    const pedido = paraMenor
      ? `com ${percentualDaCaptacao(s.percentual)} do aprovado captado, a execução depende da readequação para menor`
      : `com ${reais(s.excedente)} acima do aprovado, o excedente só pode ser usado com a readequação para maior, de até ${regra.acrescimoMaximo}% do aprovado`;
    const vencido = s.prazoDaReadequacao !== null && s.prazoDaReadequacao < hoje;
    achados.push(novoAchado(regime, {
      codigo: "READEQUACAO_DA_CAPTACAO",
      severidade: paraMenor && vencido ? "alerta" : "info",
      resultado: s.prazoDaReadequacao ? "revisar" : "nao_calculavel",
      entidade: { tipo: "prestacao", id: null },
      ref: paraMenor ? "para_menor" : "para_maior",
      mensagem: s.prazoDaReadequacao
        ? `${pedido.replace(/^./, c => c.toUpperCase())}; ${vencido ? "o prazo do pedido venceu em" : "o pedido vai até"} ${dataBr(s.prazoDaReadequacao)}, ${regra.prazoDaReadequacao.quantidade} dias do fim da captação (${dataBr(fimDaCaptacao!)}). Registre o pedido em Orçamento, Alterações.`
        : `${pedido.replace(/^./, c => c.toUpperCase())}, pedida em ${regra.prazoDaReadequacao.quantidade} dias do fim da captação. Informe o fim da captação nos dados oficiais para contar o prazo.`,
      dados: { faixa: s.faixa, captado: s.captado / 100, aprovado: s.aprovado / 100, prazo: s.prazoDaReadequacao },
      fonte: { ...(regra.fontes.readequacao ?? regra.fontes.liberacao) },
    }));
  }

  // Captação encerrada abaixo do mínimo da redução: indeferimento.
  if (s.faixa === "abaixo_do_minimo" && regra.minimoDaReducao !== null && !s.readequada && fimDaCaptacao && fimDaCaptacao < hoje) {
    achados.push(novoAchado(regime, {
      codigo: "CAPTACAO_INSUFICIENTE",
      severidade: "alerta",
      entidade: { tipo: "prestacao", id: null },
      ref: "captacao",
      mensagem: `A captação terminou em ${dataBr(fimDaCaptacao)} com ${reais(s.captado)}, ${percentualDaCaptacao(s.percentual)} do aprovado (${reais(s.aprovado)}), abaixo dos ${regra.minimoDaReducao}% que permitem a readequação: o projeto é indeferido e o captado é recolhido. Confira se o extrato da conta de captação está completo.`,
      dados: { captado: s.captado / 100, aprovado: s.aprovado / 100, percentual: Math.round(s.percentual * 10) / 10, fim_captacao: fimDaCaptacao },
      fonte: { ...(regra.fontes.reducao ?? regra.fontes.liberacao) },
    }));
  }

  // Acima do acréscimo máximo: o que passa é recolhido.
  const acima = regraDoRegime(regime, "captacao_acima");
  if (s.faixa === "excedente" && acima) {
    achados.push(novoAchado(regime, {
      codigo: "CAPTADO_ACIMA_DO_AUTORIZADO",
      severidade: acima.severidade,
      entidade: { tipo: "prestacao", id: null },
      ref: "captado",
      mensagem: `Os aportes do extrato somam ${reais(s.captado)}, acima de ${100 + (regra.acrescimoMaximo ?? 0)}% do aprovado (${reais(s.captado - s.acimaDoLimite)}): ${reais(s.acimaDoLimite)} são desconsiderados e recolhidos.`,
      dados: { captado: s.captado / 100, limite: (s.captado - s.acimaDoLimite) / 100, excedente: s.acimaDoLimite / 100 },
    }));
  }
  return achados;
}
