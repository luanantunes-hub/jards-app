// Checagens da conciliação com o extrato (P2.6, P2.7, P2.8): débito sem
// despesa, débito com pagamentos acima do valor, pagamento sem débito,
// pagamentos sem extrato nenhum e número do pagamento diferente do extrato.

import { lancamentoEsperaPagamento, situacaoDoLancamento } from "../conciliacao";
import { normalizarDocumento } from "../extrato";
import { rotuloDaForma } from "../pagamentos";
import { centavos, dataBr, novoAchado, reais, severidadeDaChecagem, type Achado, type EstadoDaPrestacao, type PagamentoDoEstado } from "./catalogo";

export function checarConciliacao(estado: EstadoDaPrestacao): Achado[] {
  const { regime } = estado;
  const rejeitadas = new Set(estado.despesas.filter(d => d.status === "rejeitado").map(d => d.id));
  const pagamentos = estado.pagamentos.filter(p => !rejeitadas.has(p.despesa_id));
  const nomes = new Map(estado.despesas.map(d => [d.id, d.nome_arquivo]));
  const achados: Achado[] = [];

  if (!estado.lancamentos.length) {
    if (pagamentos.length) {
      achados.push(novoAchado(regime, {
        codigo: "EXTRATO_AUSENTE", severidade: "alerta", entidade: { tipo: "prestacao", id: null },
        mensagem: `${pagamentos.length === 1 ? "1 pagamento registrado" : `${pagamentos.length} pagamentos registrados`} e nenhum extrato importado: importe o extrato da conta do projeto para conciliar.`,
        dados: { pagamentos: pagamentos.length },
      }));
    }
    return achados;
  }

  const porLancamento = new Map<string, PagamentoDoEstado[]>();
  for (const p of pagamentos) if (p.lancamento_id) porLancamento.set(p.lancamento_id, [...(porLancamento.get(p.lancamento_id) ?? []), p]);

  for (const l of estado.lancamentos) {
    if (!lancamentoEsperaPagamento(l)) continue;
    const ligados = porLancamento.get(l.id) ?? [];
    const situacao = situacaoDoLancamento(l, ligados);
    const valor = centavos(l.valor);
    const ligado = ligados.reduce((s, p) => s + centavos(p.valor), 0);
    const debito = `Débito de ${reais(valor)} em ${dataBr(l.data)} (${l.historico.trim() || "sem histórico"})`;
    const dados = { data: l.data, valor: valor / 100, historico: l.historico, ligado: ligado / 100 };
    const entidade = { tipo: "lancamento" as const, id: l.id };
    if (situacao === "pendente") {
      achados.push(novoAchado(regime, { codigo: "DEBITO_SEM_COMPROVANTE", severidade: "bloqueio", entidade, mensagem: `${debito} sem despesa ligada.`, dados }));
    } else if (situacao === "parcial") {
      achados.push(novoAchado(regime, { codigo: "DEBITO_SEM_COMPROVANTE", severidade: "bloqueio", entidade, dados,
        mensagem: `${debito}: ${reais(ligado)} ligados a despesas, faltam ${reais(valor - ligado)}.` }));
    } else if (situacao === "excedido") {
      achados.push(novoAchado(regime, { codigo: "LANCAMENTO_EXCEDIDO", severidade: "alerta", entidade, dados,
        mensagem: `${debito}: os pagamentos ligados somam ${reais(ligado)}, mais que o débito.` }));
    }
  }

  // O número do pagamento é o que o Salic compara com o do extrato (sem ponto nem vírgula).
  const lancamentos = new Map(estado.lancamentos.map(l => [l.id, l]));
  const severidadeNumero = severidadeDaChecagem(regime, "NUMERO_PAGAMENTO_DIVERGENTE", "info");
  for (const p of pagamentos) {
    if (!p.lancamento_id) {
      achados.push(novoAchado(regime, {
        codigo: "PAGAMENTO_SEM_LANCAMENTO", severidade: "alerta", entidade: { tipo: "pagamento", id: p.id },
        mensagem: `Pagamento de ${reais(centavos(p.valor))} em ${dataBr(p.data)} (${rotuloDaForma(p.forma)}) de "${nomes.get(p.despesa_id) ?? "despesa"}" sem o débito no extrato.`,
        dados: { despesa: nomes.get(p.despesa_id) ?? null, data: p.data, valor: Number(p.valor), forma: p.forma },
      }));
      continue;
    }
    const l = lancamentos.get(p.lancamento_id);
    const doExtrato = l ? (l.numero_normalizado ?? normalizarDocumento(l.numero_documento))?.toUpperCase() ?? null : null;
    const doPagamento = normalizarDocumento(p.numero_documento)?.toUpperCase() ?? null;
    if (l && doExtrato && doPagamento && doExtrato !== doPagamento) {
      achados.push(novoAchado(regime, {
        codigo: "NUMERO_PAGAMENTO_DIVERGENTE", severidade: severidadeNumero, entidade: { tipo: "pagamento", id: p.id },
        mensagem: `O pagamento de ${reais(centavos(p.valor))} em ${dataBr(p.data)} de "${nomes.get(p.despesa_id) ?? "despesa"}" tem o número ${doPagamento}, e o débito do extrato, ${doExtrato}.`,
        dados: { despesa: nomes.get(p.despesa_id) ?? null, pagamento: doPagamento, extrato: doExtrato },
      }));
    }
  }
  return achados;
}
