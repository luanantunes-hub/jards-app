// O acerto de contas do borderô (plano do módulo, PD7.9, primeiro corte): quanto cabe a cada parte do líquido. Sem tela e sem banco; tudo em centavos inteiros.
//
// Decisão do dono (13/11/2026): o acerto sai do borderô, o app NÃO paga nada: só calcula, registra e exporta. Cada parte tem a forma do que recebe:
// um percentual do líquido, um valor fixo, ou o resto (o que sobra depois das outras). Aprovar e anotar a data do pagamento é manual.

import { emCentavos, formatarReais } from "@/lib/producao/bordero";
import type { FormaDoAcerto, PapelNoAcerto, SituacaoDoAcertoDoBordero } from "@/lib/producao/estados";

export const ROTULO_DO_PAPEL_NO_ACERTO: Record<PapelNoAcerto, string> = { companhia: "Companhia", casa: "Casa", patrocinador: "Patrocinador", outra: "Outra parte" };
export const ROTULO_DA_FORMA_DO_ACERTO: Record<FormaDoAcerto, string> = { percentual: "% do líquido", fixo: "Valor fixo", resto: "O que sobra" };
export const ROTULO_DA_SITUACAO_DO_ACERTO: Record<SituacaoDoAcertoDoBordero, string> = { proposto: "Proposto", aprovado: "Aprovado" };

/** Nomes que a pessoa escolhe com um clique ao criar uma parte; a forma e o valor ela define pelo contrato. */
export const MODELOS_DE_PARTE: readonly { parte: string; papel: PapelNoAcerto; forma: FormaDoAcerto }[] = [
  { parte: "Companhia", papel: "companhia", forma: "percentual" },
  { parte: "Casa", papel: "casa", forma: "percentual" },
  { parte: "Patrocinador", papel: "patrocinador", forma: "fixo" },
  { parte: "Outra parte", papel: "outra", forma: "resto" },
];

export type AcertoDoBordero = {
  id: string; parte: string; papel: PapelNoAcerto; forma: FormaDoAcerto; valor: number;
  situacao: SituacaoDoAcertoDoBordero; aprovado_em: string | null; pago_em: string | null;
};

export type LinhaDoAcerto = AcertoDoBordero & { valorCentavos: number; participacao: number | null };
export type ContasDoAcerto = {
  linhas: LinhaDoAcerto[]; totalCentavos: number; sobraCentavos: number; avisos: string[];
};

/**
 * O que cabe a cada parte. O percentual incide sobre o líquido (arredondado ao centavo), o fixo é o próprio valor e o resto é o líquido menos as outras
 * partes (nunca negativo: se as outras passam do líquido, o resto é zero e o aviso diz). `sobraCentavos` é o que fica sem destino: sem parte "resto" e com
 * porcentagens abaixo de 100, sobra; com as partes passando do líquido, fica negativo. Líquido negativo ou zero: ninguém recebe nada.
 */
export function calcularAcerto(liquidoCentavos: number, acertos: readonly AcertoDoBordero[]): ContasDoAcerto {
  const base = Math.max(0, liquidoCentavos);
  const ordenadas = [...acertos].sort((a, b) => a.parte.localeCompare(b.parte, "pt-BR"));
  const valores = new Map<string, number>();
  for (const acerto of ordenadas) {
    if (acerto.forma === "percentual") valores.set(acerto.id, Math.round((base * emCentavos(acerto.valor)) / 10000));
    else if (acerto.forma === "fixo") valores.set(acerto.id, emCentavos(acerto.valor));
  }
  const semResto = [...valores.values()].reduce((soma, valor) => soma + valor, 0);
  const resto = ordenadas.find(acerto => acerto.forma === "resto");
  if (resto) valores.set(resto.id, Math.max(0, base - semResto));
  const total = [...valores.values()].reduce((soma, valor) => soma + valor, 0);
  const linhas = ordenadas.map(acerto => {
    const valorCentavos = valores.get(acerto.id) ?? 0;
    return { ...acerto, valorCentavos, participacao: base > 0 ? valorCentavos / base : null };
  });
  const sobra = base - total;
  const avisos: string[] = [];
  if (liquidoCentavos <= 0 && ordenadas.length > 0) avisos.push("O líquido do borderô é zero ou negativo: não há o que dividir.");
  else if (ordenadas.length > 0 && sobra < 0) avisos.push(`As partes passam do líquido em ${formatarReais(-sobra)}: confira os valores fixos.`);
  else if (ordenadas.length > 0 && !resto && sobra > 0) avisos.push(`Sobram ${formatarReais(sobra)} sem destino: nenhuma parte recebe o que sobra e as porcentagens não chegam a 100.`);
  return { linhas, totalCentavos: total, sobraCentavos: sobra, avisos };
}

/** Soma das porcentagens já usadas, para a tela mostrar quanto ainda cabe (o banco recusa passar de 100). */
export function percentualUsado(acertos: readonly Pick<AcertoDoBordero, "forma" | "valor">[]): number {
  return Math.round(acertos.filter(acerto => acerto.forma === "percentual").reduce((soma, acerto) => soma + acerto.valor, 0) * 100) / 100;
}

export type LeituraDoAcerto = { ok: true; valor: { parte: string; papel: PapelNoAcerto; forma: FormaDoAcerto; valor: number } } | { ok: false; erro: string; campo: string };

/** A parte como o banco confere: nome de 1 a 80, porcentagem de 0 a 100, valor fixo em reais, e o resto sem valor. */
export function lerAcerto(campos: { parte: string; papel: PapelNoAcerto; forma: FormaDoAcerto; valor: string }, lerValor: (texto: string) => number | null): LeituraDoAcerto {
  const parte = campos.parte.trim();
  if (parte === "") return { ok: false, erro: "Escreva quem recebe (companhia, casa, patrocinador...).", campo: "parte" };
  if (parte.length > 80) return { ok: false, erro: "O nome pode ter até 80 letras.", campo: "parte" };
  if (campos.forma === "resto") return { ok: true, valor: { parte, papel: campos.papel, forma: campos.forma, valor: 0 } };
  const valor = lerValor(campos.valor);
  if (valor === null) return { ok: false, erro: campos.forma === "percentual" ? "Digite a porcentagem, por exemplo 50 ou 12,5." : "Digite o valor em reais, por exemplo 2.000 ou 350,50.", campo: "valor" };
  if (campos.forma === "percentual" && valor > 100) return { ok: false, erro: "A porcentagem vai de 0 a 100.", campo: "valor" };
  if (valor > 999999999999) return { ok: false, erro: "Esse valor é grande demais.", campo: "valor" };
  return { ok: true, valor: { parte, papel: campos.papel, forma: campos.forma, valor } };
}

/** O texto do acerto para colar num e-mail ou mandar a cada parte. */
export function textoDoAcerto(campos: { sessao: string; liquidoCentavos: number; contas: ContasDoAcerto }): string {
  const { sessao, liquidoCentavos, contas } = campos;
  const linhas = [`Acerto de contas: ${sessao}`, `Líquido do borderô: ${formatarReais(liquidoCentavos)}`];
  contas.linhas.forEach(linha => {
    const quanto = linha.forma === "percentual" ? ` (${linha.valor.toLocaleString("pt-BR")}%)` : linha.forma === "resto" ? " (o que sobra)" : "";
    const estado = linha.pago_em ? `, pago em ${formatarData(linha.pago_em)}` : linha.situacao === "aprovado" ? ", aprovado" : ", a aprovar";
    linhas.push(`  ${linha.parte}${quanto}: ${formatarReais(linha.valorCentavos)}${estado}`);
  });
  linhas.push(`Total distribuído: ${formatarReais(contas.totalCentavos)}`);
  contas.avisos.forEach(aviso => linhas.push(`Atenção: ${aviso}`));
  return linhas.join("\n");
}

function formatarData(dia: string): string {
  const [ano, mes, data] = dia.split("-");
  return `${data}/${mes}/${ano}`;
}

/** Texto de uma célula da planilha: entre aspas quando tem ; " ou quebra de linha, e sem fórmula escondida (= + - @ no começo). */
function celula(valor: string): string {
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return /[;"\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/** A planilha do acerto (CSV com ponto e vírgula e vírgula decimal, abre direto no Excel em português; o BOM vem no começo). */
export function planilhaDoAcerto(campos: { sessao: string; liquidoCentavos: number; contas: ContasDoAcerto }): string {
  const { sessao, liquidoCentavos, contas } = campos;
  const reais = (centavos: number) => (centavos / 100).toFixed(2).replace(".", ",");
  const linhas = [
    ["Sessão", sessao].map(celula).join(";"),
    ["Líquido do borderô (R$)", reais(liquidoCentavos)].map(celula).join(";"),
    "",
    ["Parte", "Papel", "Forma", "Valor ou % combinado", "A receber (R$)", "Situação", "Pago em"].map(celula).join(";"),
    ...contas.linhas.map(linha => [
      linha.parte, ROTULO_DO_PAPEL_NO_ACERTO[linha.papel], ROTULO_DA_FORMA_DO_ACERTO[linha.forma],
      linha.forma === "resto" ? "" : linha.forma === "percentual" ? `${linha.valor.toLocaleString("pt-BR")}%` : reais(emCentavos(linha.valor)),
      reais(linha.valorCentavos), ROTULO_DA_SITUACAO_DO_ACERTO[linha.situacao], linha.pago_em ? formatarData(linha.pago_em) : "",
    ].map(celula).join(";")),
    ["Total distribuído (R$)", "", "", "", reais(contas.totalCentavos)].map(celula).join(";"),
  ];
  return "﻿" + linhas.join("\r\n") + "\r\n";
}

/** O texto para o erro que o banco devolve ao gravar. */
export function mensagemDoErroDeAcerto(erro: { code?: string; message?: string }): string {
  const mensagem = erro.message ?? "";
  if (mensagem.includes("percentuais_passam_de_100")) return "As porcentagens passam de 100. Diminua uma delas.";
  if (mensagem.includes("bordero_nao_fechado")) return "Só se aprova com o borderô fechado.";
  if (mensagem.includes("acerto_aprovado")) return "Esta parte está aprovada. Desaprove antes de mudar ou apagar.";
  if (mensagem.includes("acerto_pago")) return "Esta parte já foi paga: não dá para desaprovar.";
  if (erro.code === "42501") return "Você não pode alterar o acerto (os valores pedem a permissão de dinheiro).";
  if (erro.code === "23505" && mensagem.includes("resto")) return "Só uma parte pode receber o que sobra.";
  if (erro.code === "23505") return "Já existe uma parte com esse nome neste borderô.";
  return "Não foi possível salvar. Tente de novo.";
}
