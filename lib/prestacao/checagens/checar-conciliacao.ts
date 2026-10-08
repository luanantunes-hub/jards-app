// Checagens da conciliação com o extrato (P2.6, P2.7, P2.8): débito sem
// despesa, débito com pagamentos acima do valor, pagamento sem débito,
// pagamentos sem extrato nenhum e número do pagamento diferente do extrato.
// Desde a P7.1, também o que o extrato mostra contra a regra do regime: a
// tarifa que a norma não aceita e o documento emitido muito depois do débito.

import { lancamentoEsperaPagamento, situacaoDoLancamento, type LancamentoParaConciliar } from "../conciliacao";
import { normalizarDocumento, semAcento } from "../extrato";
import { rotuloDaForma } from "../pagamentos";
import { definida, regraDoRegime, type RegimeNormativo } from "../regimes";
import { centavos, dataBr, novoAchado, reais, severidadeDaChecagem, type Achado, type EstadoDaPrestacao, type PagamentoDoEstado } from "./catalogo";

// ─── Tarifas (P7.1) ─────────────────────────────────────────────────────────

/** Tarifa de manutenção da conta (cesta, pacote de serviços): a única que a IN 159 aceita. */
const MANUTENCAO = /\bmanutencao\b|\bcesta\b|\bpacote de servicos?\b|\bmensalidade\b/;
/** Débitos que são tarifa ou encargo, mesmo sem a categoria: IOF, juros, multa, encargos. */
const ENCARGO = /\biof\b|\bjuros\b|\bmulta\b|\bencargos?\b/;

const POR_QUE: Record<string, string> = {
  so_manutencao: "só a tarifa de manutenção da conta pode ser paga com o recurso do projeto; esta pode ser glosada e devolvida com recursos próprios",
  vedadas: "a norma não admite tarifa bancária paga com o recurso do projeto; esta pode ser glosada e devolvida com recursos próprios",
  isentas: "a norma diz que a conta do projeto é isenta de tarifas; peça o estorno ao banco",
};

/** Débito de tarifa ou encargo que a regra de tarifas do regime não aceita. */
export function tarifaGlosavel(regra: string | null | undefined, l: Pick<LancamentoParaConciliar, "natureza" | "categoria" | "historico">): boolean {
  if (l.natureza !== "debito" || !regra || !(regra in POR_QUE)) return false;
  const historico = semAcento(l.historico ?? "");
  const encargo = ENCARGO.test(historico) && (l.categoria === "tarifa" || l.categoria === "outro");
  if (l.categoria !== "tarifa" && !encargo) return false;
  return regra !== "so_manutencao" || encargo || !MANUTENCAO.test(historico);
}

function checarTarifas(estado: EstadoDaPrestacao, regime: RegimeNormativo | null): Achado[] {
  const contas = regime ? definida(regime.contas) : null;
  const tarifas = contas?.tarifas;
  if (!tarifas || !(tarifas.regra in POR_QUE)) return [];
  return estado.lancamentos.filter(l => tarifaGlosavel(tarifas.regra, l)).map(l => novoAchado(regime, {
    codigo: "TARIFA_GLOSAVEL",
    severidade: severidadeDaChecagem(regime, "TARIFA_GLOSAVEL", "alerta"),
    entidade: { tipo: "lancamento", id: l.id },
    mensagem: `Débito de ${reais(centavos(l.valor))} em ${dataBr(l.data)} (${l.historico.trim() || "sem histórico"}): ${POR_QUE[tarifas.regra]}.`,
    dados: { data: l.data, valor: Number(l.valor), historico: l.historico, regra: tarifas.regra },
    fonte: tarifas.fonte,
  }));
}

// ─── Emissão depois do débito (P7.1) ────────────────────────────────────────

const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);

/**
 * Documento emitido mais de N dias depois do primeiro débito que o paga
 * (IN 159, art. 18, XXIX: 30 dias). Sem a regra no regime, nada a checar.
 */
function checarEmissaoPosDebito(estado: EstadoDaPrestacao, regime: RegimeNormativo | null, pagamentos: readonly PagamentoDoEstado[]): Achado[] {
  const regra = regraDoRegime(regime, "emissao_30_dias");
  const limite = Number(regra?.parametros?.dias);
  if (!regra || !Number.isFinite(limite)) return [];
  const datasDoDebito = new Map(estado.lancamentos.map(l => [l.id, l.data]));
  const achados: Achado[] = [];
  for (const despesa of estado.despesas) {
    if (despesa.status === "rejeitado" || !despesa.data_doc) continue;
    const debitos = pagamentos.filter(p => p.despesa_id === despesa.id && p.lancamento_id)
      .map(p => datasDoDebito.get(p.lancamento_id!)).filter((d): d is string => !!d).sort();
    if (!debitos.length) continue;
    const dias = diasEntre(debitos[0], despesa.data_doc);
    if (dias <= limite) continue;
    achados.push(novoAchado(regime, {
      codigo: "DOC_EMISSAO_POS_DEBITO",
      severidade: severidadeDaChecagem(regime, "DOC_EMISSAO_POS_DEBITO", "alerta"),
      entidade: { tipo: "despesa", id: despesa.id },
      mensagem: `"${despesa.nome_arquivo}" foi emitido em ${dataBr(despesa.data_doc)}, ${dias} dias depois do débito de ${dataBr(debitos[0])}: o regime aceita até ${limite} dias.`,
      dados: { despesa: despesa.nome_arquivo, emissao: despesa.data_doc, debito: debitos[0], dias, limite },
    }));
  }
  return achados;
}

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
  achados.push(...checarTarifas(estado, regime), ...checarEmissaoPosDebito(estado, regime, pagamentos));
  return achados;
}
