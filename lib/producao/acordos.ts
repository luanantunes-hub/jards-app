// Os acordos da temporada (plano do módulo, PD4.5, primeiro corte): contraparte, tipo, sentido, condições, situação e as datas cobertas. Sem tela e sem banco.
//
// O comprometido do orçamento (PD5.1) vem daqui: um acordo a pagar, assinado, soma o seu valor firme (o maior entre o valor fixo e a garantia) na linha do
// orçamento a que está ligado. O percentual da bilheteria e o bônus por público são variáveis: só se sabem depois da sessão (borderô), e ficam de fora do firme.

import { emCentavos, formatarReais } from "@/lib/producao/dinheiro";
import { montarPlanilha, reaisNaPlanilha } from "@/lib/producao/planilha";
import { SITUACOES_DO_ACORDO, type SentidoDoAcordo, type SituacaoDoAcordo, type TipoDeAcordo } from "@/lib/producao/estados";

export const ROTULO_DO_TIPO_DE_ACORDO: Record<TipoDeAcordo, string> = { cache: "Cachê", bilheteria: "Bilheteria", misto: "Cachê e bilheteria", cessao_de_espaco: "Cessão de espaço", outro: "Outro" };
export const ROTULO_DO_SENTIDO_DO_ACORDO: Record<SentidoDoAcordo, string> = { a_pagar: "A pagar", a_receber: "A receber" };
export const ROTULO_DA_SITUACAO_DO_ACORDO: Record<SituacaoDoAcordo, string> = { rascunho: "Rascunho", revisao: "Em revisão", para_assinatura: "Para assinatura", assinado: "Assinado", encerrado: "Encerrado" };

export type AcordoDaTemporada = {
  id: string; contraparte: string; tipo: TipoDeAcordo; sentido: SentidoDoAcordo; situacao: SituacaoDoAcordo;
  valor_fixo: number | null; garantia: number | null; percentual_bilheteria: number | null; bonus_publico: number | null; bonus_valor: number | null;
  despesas_nossas: string | null; despesas_da_contraparte: string | null; retencoes: string | null; observacao: string | null; assinado_em: string | null;
};

/** O próximo passo da situação, ou nulo no fim (encerrado). */
export function proximaSituacaoDoAcordo(situacao: SituacaoDoAcordo): SituacaoDoAcordo | null {
  const indice = SITUACOES_DO_ACORDO.indexOf(situacao);
  return SITUACOES_DO_ACORDO[indice + 1] ?? null;
}

/** O passo de volta: só enquanto não está assinado (rascunho, revisão, para assinatura). */
export function situacaoAnteriorDoAcordo(situacao: SituacaoDoAcordo): SituacaoDoAcordo | null {
  const indice = SITUACOES_DO_ACORDO.indexOf(situacao);
  return indice >= 1 && indice <= 2 ? SITUACOES_DO_ACORDO[indice - 1] : null;
}

/** O acordo assinado ou encerrado não muda condições, contraparte nem datas. */
export const acordoTravado = (situacao: SituacaoDoAcordo) => situacao === "assinado" || situacao === "encerrado";

/** O valor firme, em centavos: o maior entre o valor fixo e a garantia (zero se nenhum). */
export function valorFirmeDoAcordoEmCentavos(acordo: Pick<AcordoDaTemporada, "valor_fixo" | "garantia">): number {
  return Math.max(emCentavos(acordo.valor_fixo ?? 0), emCentavos(acordo.garantia ?? 0));
}

/** O que o acordo compromete no orçamento, em centavos: o valor firme de um acordo a pagar assinado (ou encerrado); senão, nulo (não compromete). */
export function comprometidoDoAcordoEmCentavos(acordo: Pick<AcordoDaTemporada, "sentido" | "situacao" | "valor_fixo" | "garantia">): number | null {
  return acordo.sentido === "a_pagar" && acordoTravado(acordo.situacao) ? valorFirmeDoAcordoEmCentavos(acordo) : null;
}

/** As condições numa frase: "R$ 8.000,00 fixo · garantia R$ 10.000,00 · 20% da bilheteria · bônus de R$ 500,00 a partir de 300 pessoas". */
export function resumoDasCondicoes(acordo: Pick<AcordoDaTemporada, "valor_fixo" | "garantia" | "percentual_bilheteria" | "bonus_publico" | "bonus_valor">): string {
  const partes: string[] = [];
  if (acordo.valor_fixo !== null) partes.push(`${formatarReais(emCentavos(acordo.valor_fixo))} fixo`);
  if (acordo.garantia !== null) partes.push(`garantia ${formatarReais(emCentavos(acordo.garantia))}`);
  if (acordo.percentual_bilheteria !== null) partes.push(`${acordo.percentual_bilheteria.toLocaleString("pt-BR")}% da bilheteria`);
  if (acordo.bonus_publico !== null && acordo.bonus_valor !== null) partes.push(`bônus de ${formatarReais(emCentavos(acordo.bonus_valor))} a partir de ${acordo.bonus_publico.toLocaleString("pt-BR")} pessoas`);
  return partes.length > 0 ? partes.join(" · ") : "Sem condições de valor";
}

export type LeituraDoAcordo =
  | { ok: true; valor: Pick<AcordoDaTemporada, "contraparte" | "tipo" | "sentido" | "valor_fixo" | "garantia" | "percentual_bilheteria" | "bonus_publico" | "bonus_valor" | "despesas_nossas" | "despesas_da_contraparte" | "retencoes" | "observacao"> }
  | { ok: false; erro: string; campo: string };

type CamposDoAcordo = {
  contraparte: string; tipo: TipoDeAcordo; sentido: SentidoDoAcordo; valorFixo: string; garantia: string; percentual: string; bonusPublico: string; bonusValor: string;
  despesasNossas: string; despesasDaContraparte: string; retencoes: string; observacao: string;
};

/**
 * O acordo como o banco confere: contraparte de 1 a 120 letras, valores de 0 a 999.999.999.999,99 (em branco vale nenhum), percentual de 0 a 100, bônus com o
 * público e o valor juntos (ou nenhum dos dois) e textos de até 400 letras (observação, 500). `lerValor` é a leitura de reais da tela (lerValorEmReais).
 */
export function lerAcordo(campos: CamposDoAcordo, lerValor: (texto: string) => number | null): LeituraDoAcordo {
  const contraparte = campos.contraparte.trim();
  if (contraparte === "") return { ok: false, erro: "Escreva com quem é o acordo (a casa, o contratante, o elenco...).", campo: "contraparte" };
  if (contraparte.length > 120) return { ok: false, erro: "O nome pode ter até 120 letras.", campo: "contraparte" };
  const dinheiro = (texto: string, campo: string): { ok: true; valor: number | null } | { ok: false; erro: string; campo: string } => {
    if (texto.trim() === "") return { ok: true, valor: null };
    const valor = lerValor(texto);
    return valor === null || valor > 999999999999.99 ? { ok: false, erro: "Digite o valor em reais, por exemplo 8.000 ou 1.250,50.", campo } : { ok: true, valor };
  };
  const fixo = dinheiro(campos.valorFixo, "valorFixo"); if (!fixo.ok) return fixo;
  const garantia = dinheiro(campos.garantia, "garantia"); if (!garantia.ok) return garantia;
  const bonusValor = dinheiro(campos.bonusValor, "bonusValor"); if (!bonusValor.ok) return bonusValor;
  let percentual: number | null = null;
  if (campos.percentual.trim() !== "") {
    percentual = lerValor(campos.percentual);
    if (percentual === null || percentual > 100) return { ok: false, erro: "A porcentagem da bilheteria vai de 0 a 100.", campo: "percentual" };
  }
  let bonusPublico: number | null = null;
  if (campos.bonusPublico.trim() !== "") {
    bonusPublico = /^\d+$/.test(campos.bonusPublico.trim()) ? Number(campos.bonusPublico.trim()) : Number.NaN;
    if (!Number.isInteger(bonusPublico) || bonusPublico < 1 || bonusPublico > 1000000) return { ok: false, erro: "O público do bônus é um número inteiro de pessoas, de 1 a 1.000.000.", campo: "bonusPublico" };
  }
  if ((bonusPublico === null) !== (bonusValor.valor === null)) return { ok: false, erro: "O bônus pede o público e o valor juntos: preencha os dois ou nenhum.", campo: bonusPublico === null ? "bonusPublico" : "bonusValor" };
  const texto = (valor: string, limite: number, campo: string, rotulo: string): { ok: true; valor: string | null } | { ok: false; erro: string; campo: string } => {
    const limpo = valor.trim();
    return limpo.length > limite ? { ok: false, erro: `${rotulo} pode ter até ${limite} letras.`, campo } : { ok: true, valor: limpo === "" ? null : limpo };
  };
  const nossas = texto(campos.despesasNossas, 400, "despesasNossas", "O texto das despesas da companhia"); if (!nossas.ok) return nossas;
  const deles = texto(campos.despesasDaContraparte, 400, "despesasDaContraparte", "O texto das despesas da contraparte"); if (!deles.ok) return deles;
  const retencoes = texto(campos.retencoes, 400, "retencoes", "O texto das retenções"); if (!retencoes.ok) return retencoes;
  const observacao = texto(campos.observacao, 500, "observacao", "A observação"); if (!observacao.ok) return observacao;
  return {
    ok: true,
    valor: {
      contraparte, tipo: campos.tipo, sentido: campos.sentido, valor_fixo: fixo.valor, garantia: garantia.valor, percentual_bilheteria: percentual,
      bonus_publico: bonusPublico, bonus_valor: bonusValor.valor, despesas_nossas: nossas.valor, despesas_da_contraparte: deles.valor, retencoes: retencoes.valor, observacao: observacao.valor,
    },
  };
}

/** A planilha dos acordos da temporada: um por linha, com as condições, o valor firme que compromete e as datas cobertas (já escritas, por `datasDoAcordo`). */
export function planilhaDosAcordos(campos: { temporada: string; acordos: readonly AcordoDaTemporada[]; datasDoAcordo: (id: string) => string[] }): string {
  const reais = (valor: number | null) => (valor === null ? "" : reaisNaPlanilha(emCentavos(valor)));
  return montarPlanilha([
    ["Temporada", campos.temporada],
    [],
    ["Contraparte", "Tipo", "Sentido", "Situação", "Assinado em", "Valor fixo (R$)", "Garantia (R$)", "% da bilheteria", "Bônus a partir de (pessoas)", "Valor do bônus (R$)", "Valor firme (R$)", "Datas cobertas", "Despesas nossas", "Despesas da contraparte", "Retenções"],
    ...campos.acordos.map(acordo => [
      acordo.contraparte, ROTULO_DO_TIPO_DE_ACORDO[acordo.tipo], ROTULO_DO_SENTIDO_DO_ACORDO[acordo.sentido], ROTULO_DA_SITUACAO_DO_ACORDO[acordo.situacao],
      acordo.assinado_em ? acordo.assinado_em.split("-").reverse().join("/") : "", reais(acordo.valor_fixo), reais(acordo.garantia),
      acordo.percentual_bilheteria === null ? "" : String(acordo.percentual_bilheteria).replace(".", ","), acordo.bonus_publico === null ? "" : String(acordo.bonus_publico), reais(acordo.bonus_valor),
      reaisNaPlanilha(valorFirmeDoAcordoEmCentavos(acordo)), campos.datasDoAcordo(acordo.id).join(" | "), acordo.despesas_nossas ?? "", acordo.despesas_da_contraparte ?? "", acordo.retencoes ?? "",
    ]),
  ]);
}

/** O texto do acordo para colar num e-mail ou na minuta. */
export function textoDoAcordo(acordo: AcordoDaTemporada, datas: readonly string[]): string {
  const linhas = [
    `Acordo: ${acordo.contraparte} (${ROTULO_DO_TIPO_DE_ACORDO[acordo.tipo].toLowerCase()}, ${ROTULO_DO_SENTIDO_DO_ACORDO[acordo.sentido].toLowerCase()}) — ${ROTULO_DA_SITUACAO_DO_ACORDO[acordo.situacao].toLowerCase()}`,
    `Condições: ${resumoDasCondicoes(acordo)}`,
  ];
  if (datas.length > 0) linhas.push(`Datas cobertas: ${datas.join(", ")}`);
  if (acordo.despesas_nossas) linhas.push(`Despesas por nossa conta: ${acordo.despesas_nossas}`);
  if (acordo.despesas_da_contraparte) linhas.push(`Despesas por conta de ${acordo.contraparte}: ${acordo.despesas_da_contraparte}`);
  if (acordo.retencoes) linhas.push(`Retenções: ${acordo.retencoes}`);
  if (acordo.assinado_em) linhas.push(`Assinado em ${acordo.assinado_em.split("-").reverse().join("/")}`);
  return linhas.join("\n");
}

/** O texto para o erro que o banco devolve ao gravar. */
export function mensagemDoErroDeAcordo(erro: { code?: string; message?: string }): string {
  const mensagem = erro.message ?? "";
  if (mensagem.includes("acordo_encerrado")) return "O acordo está encerrado: nada muda.";
  if (mensagem.includes("acordo_assinado")) return "O acordo está assinado: as condições, a contraparte e as datas não mudam, e ele não se apaga.";
  if (mensagem.includes("acordo_situacao_invalida")) return "A situação do acordo anda um passo de cada vez.";
  if (mensagem.includes("data_de_outra_temporada")) return "Essa data não é desta temporada.";
  if (erro.code === "42501") return "Você não pode alterar os acordos (eles pedem a permissão de dinheiro).";
  if (erro.code === "23505") return "Essa data já está neste acordo.";
  return "Não foi possível salvar. Tente de novo.";
}
