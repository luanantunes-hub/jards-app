// Checagens do nível da manifestação esportiva (P8.4), escritas a partir da
// Lei de Incentivo ao Esporte (Portaria MESP 10/2026) e valendo para todo
// regime que traga as mesmas regras:
//  * o nível (formação, toda a vida, excelência) precisa estar na prestação;
//  * elaboração e captação até 10%, 7% ou 5% de fim + meio, conforme o nível,
//    ou 15% quando o projeto todo é executado no N, NE ou CO, até R$ 100 mil
//    (art. 26, regra elaboracao_por_nivel);
//  * captação por projeto até o limite do nível (art. 14, limite_de_captacao);
//  * bolsa auxílio só no nível excelência (art. 13, bolsa_auxilio);
//  * no nível excelência, CRC válida durante toda a execução, com 30 dias para
//    a nova depois de vencida (art. 31, crc_excelencia).

import { ehDespesa } from "../despesas";
import { limiteDeElaboracao, parametroDoNivel, regimePedeNivel, rotulosDoNivel } from "../nivel-esportivo";
import { basesDoOrcamento, itensDaArvore, montarArvore } from "../orcamento";
import { regraDoRegime } from "../regimes";
import { centavos, dataBr, novoAchado, reais, type Achado, type EstadoDaPrestacao } from "./catalogo";
import { captadoDoExtrato } from "./checar-financeiro";

const DIAS_PARA_NOVA_CRC = 30;
/** "Bolsa auxílio", "bolsa-atleta"; a bolsa de material ("bolsa térmica") fica de fora. */
const BOLSA_AUXILIO = /\bbolsas?[\s-]*(aux[ií]lio|atletas?)\b/i;

const valida = (d: EstadoDaPrestacao["despesas"][number]) => d.status !== "rejeitado" && ehDespesa(d.tipo);

function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function checarNivel(estado: EstadoDaPrestacao): Achado[] {
  const { regime } = estado;
  if (estado.manifestacaoEsportiva || !regimePedeNivel(regime)) return [];
  return [novoAchado(regime, {
    codigo: "NIVEL_ESPORTIVO_AUSENTE",
    severidade: "alerta",
    entidade: { tipo: "prestacao", id: null },
    mensagem: "Informe o nível da manifestação esportiva nos dados da prestação: ele define o limite de elaboração e captação (até lá conferido pelo percentual geral do regime), o limite de captação e quem pode receber bolsa.",
    dados: {},
  })];
}

function checarElaboracao(estado: EstadoDaPrestacao): Achado[] {
  const { regime } = estado;
  const limite = limiteDeElaboracao(estado);
  const nos = estado.nos ?? [];
  if (!limite || !nos.length) return [];
  const arvore = montarArvore(nos, estado.despesas.filter(valida), estado.pagamentos);
  const base = centavos(basesDoOrcamento(arvore.raizes, regime).porBase.valor_projeto ?? 0);
  const elaboracao = itensDaArvore(arvore.raizes).filter(l => l.grupo === "elaboracao").reduce((s, l) => s + centavos(l.totais.vigente), 0);
  const peloPercentual = Math.round((base * limite.percentual) / 100);
  const maximo = limite.teto === null ? peloPercentual : Math.min(peloPercentual, centavos(limite.teto));
  if (elaboracao <= maximo) return [];
  const criterio = limite.regional ? `de ${limite.percentual}% (projeto todo no N, NE ou CO)` : `de ${limite.percentual}% no nível ${rotulosDoNivel(regime)[estado.manifestacaoEsportiva!]}`;
  return [novoAchado(regime, {
    codigo: "ELABORACAO_ACIMA_DO_NIVEL",
    severidade: limite.regra.severidade,
    entidade: { tipo: "prestacao", id: null },
    ref: "elaboracao",
    mensagem: `Elaboração e captação somam ${reais(elaboracao)} no orçamento vigente, acima do limite ${criterio} sobre fim + meio (${reais(base)})${limite.teto !== null ? `, até ${reais(centavos(limite.teto))}` : ""}: o máximo é ${reais(maximo)}.`,
    dados: { elaboracao: elaboracao / 100, base: base / 100, percentual: limite.percentual, maximo: maximo / 100 },
  })];
}

function checarCaptacao(estado: EstadoDaPrestacao): Achado[] {
  const { regime } = estado;
  const regra = regraDoRegime(regime, "limite_de_captacao");
  const nivel = estado.manifestacaoEsportiva;
  if (!regra || !nivel) return [];
  const limite = parametroDoNivel(regra, nivel);
  if (limite === null) return [];
  const aprovado = estado.valorAprovado === null || estado.valorAprovado === undefined ? null : centavos(estado.valorAprovado);
  const captado = captadoDoExtrato(estado);
  const [valor, rotulo] = aprovado !== null && aprovado > captado ? [aprovado, "O valor aprovado"] : [captado, "Os aportes do extrato"];
  if (valor <= centavos(limite)) return [];
  return [novoAchado(regime, {
    codigo: "CAPTACAO_ACIMA_DO_NIVEL",
    severidade: regra.severidade,
    entidade: { tipo: "prestacao", id: null },
    ref: "captacao",
    mensagem: `${rotulo} (${reais(valor)}) ${rotulo.startsWith("Os") ? "passam" : "passa"} do limite de captação por projeto no nível ${rotulosDoNivel(regime)[nivel]} (${reais(centavos(limite))}).`,
    dados: { valor: valor / 100, limite },
  })];
}

function checarBolsa(estado: EstadoDaPrestacao): Achado[] {
  const { regime } = estado;
  const regra = regraDoRegime(regime, "bolsa_auxilio");
  const nivel = estado.manifestacaoEsportiva;
  if (!regra || !nivel || nivel === "excelencia" || !(estado.nos ?? []).length) return [];
  const arvore = montarArvore(estado.nos ?? [], estado.despesas.filter(valida), estado.pagamentos);
  return itensDaArvore(arvore.raizes)
    .filter(l => BOLSA_AUXILIO.test(l.no.nome) && centavos(l.totais.vigente) > 0)
    .map(l => novoAchado(regime, {
      codigo: "BOLSA_FORA_DA_EXCELENCIA",
      severidade: regra.severidade,
      entidade: { tipo: "prestacao", id: null },
      ref: l.no.id,
      mensagem: `O item "${l.no.nome}" (${reais(centavos(l.totais.vigente))}) parece bolsa auxílio, que só cabe no nível ${rotulosDoNivel(regime).excelencia}; o projeto é do nível ${rotulosDoNivel(regime)[nivel]}.`,
      dados: { item: l.no.nome, vigente: centavos(l.totais.vigente) / 100 },
    }));
}

function checarCrc(estado: EstadoDaPrestacao): Achado[] {
  const { regime } = estado;
  const regra = regraDoRegime(regime, "crc_excelencia");
  if (!regra || estado.manifestacaoEsportiva !== "excelencia") return [];
  const validade = estado.crcValidade?.slice(0, 10) ?? null;
  const base = { codigo: "CRC_EXCELENCIA" as const, entidade: { tipo: "prestacao" as const, id: null } };
  if (!validade) {
    return [novoAchado(regime, { ...base, severidade: "alerta", ref: "sem_validade", mensagem: "No nível excelência, a CRC precisa estar válida durante toda a execução: informe a validade dela nos dados da prestação.", dados: {} })];
  }
  const hoje = (estado.hoje ?? new Date()).toISOString().slice(0, 10);
  const limiteDaNova = somarDias(validade, DIAS_PARA_NOVA_CRC);
  if (validade < hoje) {
    const depois = estado.pagamentos.filter(p => p.data.slice(0, 10) > limiteDaNova);
    const total = depois.reduce((s, p) => s + centavos(p.valor), 0);
    return [novoAchado(regime, {
      ...base, severidade: regra.severidade, ref: "vencida",
      mensagem: `A CRC venceu em ${dataBr(validade)}; o prazo de ${DIAS_PARA_NOVA_CRC} dias para a nova ${limiteDaNova < hoje ? "terminou" : "termina"} em ${dataBr(limiteDaNova)}, depois disso os pagamentos ficam suspensos e o que for pago é ressarcido.`
        + (depois.length ? ` ${depois.length === 1 ? "1 pagamento" : `${depois.length} pagamentos`} (${reais(total)}) ${depois.length === 1 ? "foi feito" : "foram feitos"} depois desse prazo.` : ""),
      dados: { validade, limite: limiteDaNova, pagamentos: depois.length, total: total / 100 },
    })];
  }
  const fim = estado.prestacao?.data_fim_execucao?.slice(0, 10) ?? null;
  if (fim && validade < fim) {
    return [novoAchado(regime, {
      ...base, severidade: "alerta", ref: "vence_antes",
      mensagem: `A CRC vence em ${dataBr(validade)}, antes do fim da execução (${dataBr(fim)}): renove para mantê-la válida até o fim.`,
      dados: { validade, fim },
    })];
  }
  return [];
}

export function checarEsporte(estado: EstadoDaPrestacao): Achado[] {
  return [...checarNivel(estado), ...checarElaboracao(estado), ...checarCaptacao(estado), ...checarBolsa(estado), ...checarCrc(estado)];
}
