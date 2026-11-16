// O borderô da sessão (plano do módulo, PD7.4, primeiro corte): as contas (bruto, deduções, líquido), o público da casa contra o da porta e a
// conferência do que se digita. Sem tela e sem banco. Todas as contas são em centavos inteiros: nenhuma soma de reais com vírgula flutuante.
//
// Decisões do dono (13/11/2026): as deduções são uma lista aberta por sessão, SEM alíquota pronta (o percentual vem do contrato ou do município
// e o contador confere); os valores só aparecem para quem tem a permissão de dinheiro; o público é o da casa junto com o da porta, com aviso quando divergem.

import type { FormaDaDeducao, SituacaoDoBordero } from "@/lib/producao/estados";
import { montarPlanilha, reaisNaPlanilha } from "@/lib/producao/planilha";

export const ROTULO_DA_SITUACAO_DO_BORDERO: Record<SituacaoDoBordero, string> = { rascunho: "Rascunho", conferido: "Conferido", fechado: "Fechado" };
export const ROTULO_DA_FORMA_DA_DEDUCAO: Record<FormaDaDeducao, string> = { percentual: "% da receita", fixo: "Valor fixo" };

/** Nomes que a pessoa escolhe com um clique ao criar uma dedução. Só o nome e a forma: o valor ela digita, vindo do contrato ou do município. */
export const MODELOS_DE_DEDUCAO: readonly { nome: string; forma: FormaDaDeducao }[] = [
  { nome: "Taxa da casa (bilheteria)", forma: "percentual" },
  { nome: "ISS", forma: "percentual" },
  { nome: "Direitos autorais (ECAD)", forma: "percentual" },
  { nome: "Taxa de cartão ou da plataforma", forma: "percentual" },
  { nome: "Outra dedução", forma: "fixo" },
];

export type ReceitaDoBordero = { id: string; categoria: string; quantidade: number; valor_unitario: number };
export type DeducaoDoBordero = { id: string; nome: string; forma: FormaDaDeducao; valor: number; beneficiario: string | null; ordem: number };

export const emCentavos = (reais: number) => Math.round(reais * 100);

const FORMATADOR = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
/** "R$ 1.234,56" a partir de centavos inteiros. */
export function formatarReais(centavos: number): string {
  return FORMATADOR.format(centavos / 100).replace(/ /g, " ");
}

export type LinhaDaReceita = { id: string; categoria: string; quantidade: number; valorUnitarioCentavos: number; subtotalCentavos: number };
export type LinhaDaDeducao = { id: string; nome: string; forma: FormaDaDeducao; valor: number; beneficiario: string | null; descontoCentavos: number };
export type ContasDoBordero = {
  ingressos: number; brutoCentavos: number; receitas: LinhaDaReceita[]; deducoes: LinhaDaDeducao[]; totalDeducoesCentavos: number; liquidoCentavos: number; ticketMedioCentavos: number | null;
};

/**
 * As contas do borderô: o bruto é a soma de quantidade × valor de cada categoria; a dedução em porcentagem incide sobre o bruto (arredondada ao centavo) e
 * a fixa é o próprio valor; o líquido é o bruto menos todas as deduções (pode ficar negativo: a tela avisa). O ticket médio é o bruto por ingresso.
 */
export function calcularBordero(receitas: readonly ReceitaDoBordero[], deducoes: readonly DeducaoDoBordero[]): ContasDoBordero {
  const linhasDaReceita = [...receitas].sort((a, b) => a.categoria.localeCompare(b.categoria, "pt-BR")).map(receita => {
    const unitario = emCentavos(receita.valor_unitario);
    return { id: receita.id, categoria: receita.categoria, quantidade: receita.quantidade, valorUnitarioCentavos: unitario, subtotalCentavos: receita.quantidade * unitario };
  });
  const bruto = linhasDaReceita.reduce((soma, linha) => soma + linha.subtotalCentavos, 0);
  const ingressos = linhasDaReceita.reduce((soma, linha) => soma + linha.quantidade, 0);
  const linhasDaDeducao = [...deducoes].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR")).map(deducao => ({
    id: deducao.id, nome: deducao.nome, forma: deducao.forma, valor: deducao.valor, beneficiario: deducao.beneficiario,
    descontoCentavos: deducao.forma === "percentual" ? Math.round((bruto * emCentavos(deducao.valor)) / 10000) : emCentavos(deducao.valor),
  }));
  const totalDeducoes = linhasDaDeducao.reduce((soma, linha) => soma + linha.descontoCentavos, 0);
  return {
    ingressos, brutoCentavos: bruto, receitas: linhasDaReceita, deducoes: linhasDaDeducao, totalDeducoesCentavos: totalDeducoes,
    liquidoCentavos: bruto - totalDeducoes, ticketMedioCentavos: ingressos > 0 ? Math.round(bruto / ingressos) : null,
  };
}

export type PublicoDoBordero = { casa: number | null; porta: number; oficial: number | null; origem: "casa" | "porta" | "nenhuma"; aviso: string | null };

/**
 * O público da sessão: o que a casa contou e o que a porta registrou. O oficial é o da casa (a bilheteria conta quem entrou sem credencial); sem ele,
 * o da porta, se houver. O aviso aparece quando os dois divergem: a porta com mais entradas que a casa, ou uma diferença de pelo menos 5 pessoas e 5%.
 */
export function publicoDoBordero(casa: number | null, porta: number): PublicoDoBordero {
  if (casa === null) {
    return porta > 0
      ? { casa, porta, oficial: porta, origem: "porta", aviso: "A casa ainda não contou o público. Por enquanto vale o da porta, que só conta quem tem credencial." }
      : { casa, porta, oficial: null, origem: "nenhuma", aviso: null };
  }
  if (porta > casa) return { casa, porta, oficial: casa, origem: "casa", aviso: `A porta registrou ${porta} entradas e a casa contou ${casa}: a casa deveria ter pelo menos o que entrou pela porta.` };
  const diferenca = casa - porta;
  const limite = Math.max(5, Math.ceil(casa * 0.05));
  if (porta > 0 && diferenca >= limite) {
    return { casa, porta, oficial: casa, origem: "casa", aviso: `A casa contou ${casa} e a porta registrou ${porta}: ${diferenca} pessoas entraram sem credencial. Confira se está certo.` };
  }
  return { casa, porta, oficial: casa, origem: "casa", aviso: null };
}

/** O que falta antes de fechar (o fechamento não é impedido: a pessoa decide). */
export function pendenciasParaFechar(campos: { publicoCasa: number | null; porta: number; receitas: number; liquidoCentavos: number }): string[] {
  const pendencias: string[] = [];
  if (campos.publicoCasa === null && campos.porta === 0) pendencias.push("Falta o público");
  if (campos.receitas === 0) pendencias.push("Nenhuma receita lançada");
  if (campos.liquidoCentavos < 0) pendencias.push("O líquido está negativo: as deduções passam da receita");
  return pendencias;
}

/**
 * Lê um valor em reais como a pessoa digita: "50", "50,5", "1.234,56" ou "1234.56". Devolve o valor com no máximo duas casas, ou null se não for um
 * número válido não negativo. O ponto só vale como milhar quando há vírgula decimal (ou três dígitos depois dele sem vírgula).
 */
export function lerValorEmReais(texto: string): number | null {
  let bruto = texto.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (bruto === "") return null;
  if (bruto.includes(",")) bruto = bruto.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(bruto)) bruto = bruto.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(bruto)) return null;
  const numero = Number(bruto);
  return Number.isFinite(numero) ? numero : null;
}

const texto = (valor: string) => valor.trim();
const inteiro = (valor: string) => (/^\d+$/.test(texto(valor)) ? Number(texto(valor)) : Number.NaN);

export type LeituraDaReceita = { ok: true; valor: { categoria: string; quantidade: number; valor_unitario: number } } | { ok: false; erro: string; campo: string };

/** A receita como o banco confere: categoria de 1 a 60 letras, quantidade de 0 a 1.000.000 e valor unitário de 0 a 10.000.000. */
export function lerReceita(campos: { categoria: string; quantidade: string; valor: string }): LeituraDaReceita {
  const categoria = texto(campos.categoria);
  if (categoria === "") return { ok: false, erro: "Escreva a categoria do ingresso (inteira, meia, social...).", campo: "categoria" };
  if (categoria.length > 60) return { ok: false, erro: "A categoria pode ter até 60 letras.", campo: "categoria" };
  const quantidade = texto(campos.quantidade) === "" ? 0 : inteiro(campos.quantidade);
  if (!Number.isInteger(quantidade) || quantidade > 1000000) return { ok: false, erro: "A quantidade é um número inteiro de ingressos.", campo: "quantidade" };
  const valor = texto(campos.valor) === "" ? 0 : lerValorEmReais(campos.valor);
  if (valor === null || valor > 10000000) return { ok: false, erro: "Digite o valor do ingresso em reais, por exemplo 50 ou 25,50.", campo: "valor" };
  return { ok: true, valor: { categoria, quantidade, valor_unitario: valor } };
}

export type LeituraDaDeducao = { ok: true; valor: { nome: string; forma: FormaDaDeducao; valor: number; beneficiario: string | null; ordem: number } } | { ok: false; erro: string; campo: string };

/** A dedução como o banco confere: nome de 1 a 80, porcentagem de 0 a 100 ou valor fixo em reais, quem recebe até 80 e ordem de 0 a 999. */
export function lerDeducao(campos: { nome: string; forma: FormaDaDeducao; valor: string; beneficiario: string; ordem: string }): LeituraDaDeducao {
  const nome = texto(campos.nome);
  if (nome === "") return { ok: false, erro: "Escreva o nome da dedução.", campo: "nome" };
  if (nome.length > 80) return { ok: false, erro: "O nome pode ter até 80 letras.", campo: "nome" };
  const valor = lerValorEmReais(campos.valor);
  if (valor === null) return { ok: false, erro: campos.forma === "percentual" ? "Digite a porcentagem, por exemplo 5 ou 2,5." : "Digite o valor em reais, por exemplo 300 ou 1.250,50.", campo: "valor" };
  if (campos.forma === "percentual" && valor > 100) return { ok: false, erro: "A porcentagem vai de 0 a 100.", campo: "valor" };
  if (valor > 999999999999) return { ok: false, erro: "Esse valor é grande demais.", campo: "valor" };
  const beneficiario = texto(campos.beneficiario);
  if (beneficiario.length > 80) return { ok: false, erro: "Quem recebe pode ter até 80 letras.", campo: "beneficiario" };
  const ordem = texto(campos.ordem) === "" ? 0 : inteiro(campos.ordem);
  if (!Number.isInteger(ordem) || ordem > 999) return { ok: false, erro: "A ordem é um número de 0 a 999.", campo: "ordem" };
  return { ok: true, valor: { nome, forma: campos.forma, valor, beneficiario: beneficiario === "" ? null : beneficiario, ordem } };
}

/** O texto do borderô para colar num e-mail ou mandar à casa. Sem os valores quando `comDinheiro` é falso (só o público). */
export function textoDoBordero(campos: { sessao: string; situacao: SituacaoDoBordero; publico: PublicoDoBordero; contas: ContasDoBordero; comDinheiro: boolean }): string {
  const { sessao, situacao, publico, contas, comDinheiro } = campos;
  const linhas = [`Borderô: ${sessao} (${ROTULO_DA_SITUACAO_DO_BORDERO[situacao].toLowerCase()})`];
  linhas.push(`Público: ${publico.oficial === null ? "não informado" : `${publico.oficial}${publico.origem === "porta" ? " (da porta)" : ""}`}${publico.casa !== null && publico.porta > 0 ? ` · porta registrou ${publico.porta}` : ""}`);
  if (!comDinheiro) return linhas.join("\n");
  linhas.push(`Ingressos: ${contas.ingressos}`);
  contas.receitas.forEach(linha => linhas.push(`  ${linha.categoria}: ${linha.quantidade} × ${formatarReais(linha.valorUnitarioCentavos)} = ${formatarReais(linha.subtotalCentavos)}`));
  linhas.push(`Receita bruta: ${formatarReais(contas.brutoCentavos)}`);
  contas.deducoes.forEach(linha => linhas.push(`  (-) ${linha.nome}${linha.forma === "percentual" ? ` (${linha.valor.toLocaleString("pt-BR")}%)` : ""}${linha.beneficiario ? ` → ${linha.beneficiario}` : ""}: ${formatarReais(linha.descontoCentavos)}`));
  linhas.push(`Líquido: ${formatarReais(contas.liquidoCentavos)}`);
  return linhas.join("\n");
}

/**
 * A planilha do borderô (CSV com ponto e vírgula e vírgula decimal, que o Excel em português abre): o público e, para quem tem a permissão de dinheiro,
 * as receitas por categoria, a receita bruta, as deduções (com a forma, o valor e o desconto em reais) e o líquido. Sem a permissão, só o público:
 * nenhum valor sai. As contas são as mesmas da tela, em centavos.
 */
export function planilhaDoBordero(campos: { sessao: string; situacao: SituacaoDoBordero; publico: PublicoDoBordero; contas: ContasDoBordero; comDinheiro: boolean }): string {
  const { sessao, situacao, publico, contas, comDinheiro } = campos;
  const linhas: string[][] = [
    ["Borderô", sessao],
    ["Situação", ROTULO_DA_SITUACAO_DO_BORDERO[situacao]],
    [],
    ["Público (oficial)", publico.oficial === null ? "não informado" : String(publico.oficial)],
    ["Público da casa", publico.casa === null ? "não informado" : String(publico.casa)],
    ["Público da porta", String(publico.porta)],
  ];
  if (comDinheiro) {
    linhas.push([], ["Categoria", "Quantidade", "Valor unitário (R$)", "Subtotal (R$)"]);
    for (const linha of contas.receitas) linhas.push([linha.categoria, String(linha.quantidade), reaisNaPlanilha(linha.valorUnitarioCentavos), reaisNaPlanilha(linha.subtotalCentavos)]);
    linhas.push(["Receita bruta", String(contas.ingressos), "", reaisNaPlanilha(contas.brutoCentavos)]);
    linhas.push([], ["Dedução", "Forma", "Valor", "Beneficiário", "Desconto (R$)"]);
    for (const linha of contas.deducoes) {
      linhas.push([linha.nome, ROTULO_DA_FORMA_DA_DEDUCAO[linha.forma], linha.forma === "percentual" ? `${String(linha.valor).replace(".", ",")}%` : reaisNaPlanilha(emCentavos(linha.valor)), linha.beneficiario ?? "", reaisNaPlanilha(linha.descontoCentavos)]);
    }
    linhas.push(["Total das deduções", "", "", "", reaisNaPlanilha(contas.totalDeducoesCentavos)]);
    linhas.push([], ["Líquido (R$)", reaisNaPlanilha(contas.liquidoCentavos)], ["Ticket médio (R$)", contas.ticketMedioCentavos === null ? "" : reaisNaPlanilha(contas.ticketMedioCentavos)]);
  }
  return montarPlanilha(linhas);
}

/** O texto para o erro que o banco devolve ao gravar. */
export function mensagemDoErroDeBordero(erro: { code?: string; message?: string }): string {
  const mensagem = erro.message ?? "";
  if (mensagem.includes("bordero_fechado")) return "O borderô está fechado. Reabra para mudar.";
  if (mensagem.includes("acerto_aprovado")) return "O acerto tem partes aprovadas. Desaprove-as antes de reabrir o borderô.";
  if (erro.code === "42501") return "Você não pode alterar este borderô (os valores pedem a permissão de dinheiro).";
  if (erro.code === "23505" && mensagem.includes("categoria")) return "Já existe uma receita com essa categoria neste borderô.";
  if (erro.code === "23505") return "Esta sessão já tem borderô.";
  return "Não foi possível salvar. Tente de novo.";
}
