// Checagens das contas do projeto pelo extrato (P8.1), escritas a partir da
// Lei de Incentivo ao Esporte (LC 222/2025, Decreto 12.861/2026 e Portaria
// MESP 10/2026) e valendo para todo regime que traga a mesma regra:
//  * saque em dinheiro, quando o regime veda o saque como meio de pagamento;
//  * captação acima do autorizado (regra captar_acima);
//  * aporte creditado fora da conta de captação (regra deposito_identificado);
//  * débito na conta de movimentação antes do Termo ou depois do fim da
//    vigência, que a LIE manda ressarcir com multa de 5% (Decreto 12.861,
//    art. 29, § 3º; Portaria 10, arts. 40 e 80, § 7º).

import { formaPeloHistorico } from "../conciliacao";
import { definida, regraDoRegime } from "../regimes";
import { centavos, dataBr, novoAchado, reais, type Achado, type EstadoDaPrestacao } from "./catalogo";
import { captadoDoExtrato } from "./checar-financeiro";

const tipoDaConta = (estado: EstadoDaPrestacao, contaId: string | undefined) =>
  contaId ? estado.contas?.find(c => c.id === contaId)?.tipo ?? null : null;

const debito = (l: EstadoDaPrestacao["lancamentos"][number]) =>
  `${reais(centavos(l.valor))} em ${dataBr(l.data)} (${l.historico.trim() || "sem histórico"})`;

/** Saque no extrato quando o regime veda o saque (na LIE, "proibido em qualquer hipótese"). */
function checarSaques(estado: EstadoDaPrestacao): Achado[] {
  const { regime } = estado;
  const pagamentos = regime ? definida(regime.pagamentos) : null;
  if (!pagamentos?.meiosVedados.includes("saque")) return [];
  return estado.lancamentos
    .filter(l => l.natureza === "debito" && formaPeloHistorico(l.historico) === "saque")
    .map(l => novoAchado(regime, {
      codigo: "SAQUE_NO_EXTRATO",
      severidade: "bloqueio",
      entidade: { tipo: "lancamento", id: l.id },
      mensagem: `Saque de ${debito(l)}: o regime não admite saque em dinheiro da conta do projeto; o valor pode ser glosado.`,
      dados: { data: l.data, valor: Number(l.valor), historico: l.historico },
      fonte: pagamentos.fonte,
    }));
}

/** Aportes somados acima do valor autorizado (regra captar_acima). */
function checarCaptacaoAcima(estado: EstadoDaPrestacao): Achado[] {
  const { regime } = estado;
  const regra = regraDoRegime(regime, "captar_acima");
  if (!regra || estado.valorAprovado === null || estado.valorAprovado === undefined) return [];
  const captado = captadoDoExtrato(estado);
  const autorizado = centavos(estado.valorAprovado);
  if (!autorizado || captado <= autorizado) return [];
  return [novoAchado(regime, {
    codigo: "CAPTADO_ACIMA_DO_AUTORIZADO",
    severidade: regra.severidade,
    entidade: { tipo: "prestacao", id: null },
    ref: "captado",
    mensagem: `Os aportes do extrato somam ${reais(captado)}, acima do valor autorizado (${reais(autorizado)}): o excedente de ${reais(captado - autorizado)} não pode ser usado e vai ao Tesouro.`,
    dados: { captado: captado / 100, autorizado: autorizado / 100, excedente: (captado - autorizado) / 100 },
  })];
}

/** Aporte creditado numa conta que não é a de captação (regra deposito_identificado). */
function checarAporteForaDaCaptacao(estado: EstadoDaPrestacao): Achado[] {
  const { regime } = estado;
  const regra = regraDoRegime(regime, "deposito_identificado");
  if (!regra || !estado.contas?.some(c => c.tipo === "captacao")) return [];
  return estado.lancamentos
    .filter(l => l.natureza === "credito" && l.categoria === "aporte")
    .filter(l => {
      const tipo = tipoDaConta(estado, l.conta_id);
      return tipo !== null && tipo !== "captacao";
    })
    .map(l => novoAchado(regime, {
      codigo: "APORTE_FORA_DA_CAPTACAO",
      severidade: regra.severidade,
      entidade: { tipo: "lancamento", id: l.id },
      mensagem: `Aporte de ${debito(l)} creditado fora da conta de captação: só conta como incentivo o que entra na captação, com recibo.`,
      dados: { data: l.data, valor: Number(l.valor), historico: l.historico },
    }));
}

/** Multa sobre a despesa feita fora da vigência (Decreto 12.861, art. 29, § 3º). */
const MULTA_FORA_DA_VIGENCIA = 0.05;

/**
 * Débito na conta de movimentação antes da assinatura do Termo (ou do início
 * da execução, sem a data do Termo) ou depois do fim da vigência. Vale na
 * área do esporte, onde a despesa fora da vigência é ressarcida com multa.
 */
function checarDebitoForaDaVigencia(estado: EstadoDaPrestacao): Achado[] {
  const { regime } = estado;
  if (regime?.area !== "esporte") return [];
  const datas = estado.prestacao ?? {};
  const inicio = datas.data_termo ?? datas.data_inicio_execucao ?? null;
  const rotuloInicio = datas.data_termo ? "da assinatura do Termo" : "do início da execução";
  const fim = datas.data_fim_execucao ?? null;
  if (!inicio && !fim) return [];
  const periodo = definida(regime.despesas)?.periodo;
  return estado.lancamentos
    .filter(l => l.natureza === "debito" && l.categoria !== "transferencia" && l.categoria !== "aplicacao" && l.categoria !== "devolucao")
    .filter(l => {
      const tipo = tipoDaConta(estado, l.conta_id);
      return tipo === null || tipo === "movimento" || tipo === "unica";
    })
    .flatMap(l => {
      const data = l.data.slice(0, 10);
      const fora = inicio && data < inicio ? { ref: "antes", texto: `antes ${rotuloInicio} (${dataBr(inicio)})` }
        : fim && data > fim ? { ref: "depois", texto: `depois do fim da vigência (${dataBr(fim)})` }
        : null;
      if (!fora) return [];
      const valor = centavos(l.valor);
      const ressarcir = Math.round(valor * (1 + MULTA_FORA_DA_VIGENCIA));
      return [novoAchado(regime, {
        codigo: "DEBITO_FORA_DA_VIGENCIA",
        severidade: "alerta",
        entidade: { tipo: "lancamento", id: l.id },
        ref: fora.ref,
        mensagem: `Débito de ${debito(l)}, ${fora.texto}: despesa fora da vigência é ressarcida com multa de 5%, por GRU (${reais(ressarcir)}).`,
        dados: { data, valor: valor / 100, ressarcir: ressarcir / 100, inicio, fim },
        fonte: periodo ? { ...periodo.fonte } : null,
      })];
    });
}

export function checarContas(estado: EstadoDaPrestacao): Achado[] {
  return [...checarSaques(estado), ...checarCaptacaoAcima(estado), ...checarAporteForaDaCaptacao(estado), ...checarDebitoForaDaVigencia(estado)];
}
